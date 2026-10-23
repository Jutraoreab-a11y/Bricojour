-- =====================================================================
-- Mise à jour du 22/10/2026 : Bricojour est une marketplace de mise en
-- relation et de facilitation de paiement. Elle NE GÈRE PAS les
-- déclarations (Urssaf, CESU, INPI) de ses utilisateurs.
--
--  1. Suppression du suivi déclaratif et de la ventilation 10 % / 10 %.
--  2. Les montants côté client sortent de la table missions (lisible par
--     l'intervenant) : l'intervenant ne peut jamais lire les frais client.
--  3. Table `transactions` : un enregistrement par mission validée,
--     avec les montants du split Stripe Connect.
--  4. Preuve d'acceptation de l'engagement de déclaration des revenus.
-- =====================================================================

-- ---------- 1. Suppression du volet déclaratif ----------
alter table public.missions
  drop column if exists urssaf_status,
  drop column if exists urssaf_reference,
  drop column if exists client_fee_dossier_cents,
  drop column if exists client_fee_declaratif_cents,
  drop column if exists worker_fee_dossier_cents,
  drop column if exists worker_fee_declaratif_cents;

drop type if exists public.urssaf_status;

-- ---------- 2. Montants client : hors de la ligne mission ----------
-- L'intervenant lit la ligne mission (adresse, heures, sa commission).
-- Les frais client n'y figurent plus ; le client les obtient par fonction.
alter table public.missions
  drop column if exists client_total_cents,
  drop column if exists client_fee_cents;

comment on column public.missions.platform_fee_cents  is 'Commission de service Bricojour (20 %) retenue sur la main-d’œuvre de l’intervenant';
comment on column public.missions.worker_payout_cents is 'Net intervenant : main-d’œuvre − commission + matériel accepté';

create or replace function public.mission_client_amounts(p_mission_id uuid)
returns table (
  labor_cents        int,
  client_fee_cents   int,
  materials_cents    int,
  client_total_cents int
)
language sql stable security definer set search_path = public as $$
  select m.labor_cents,
         round(m.labor_cents * 0.20)::int,
         case when m.material_status in ('pending', 'approved') then m.material_cents else 0 end,
         m.labor_cents + round(m.labor_cents * 0.20)::int
           + case when m.material_status in ('pending', 'approved') then m.material_cents else 0 end
  from public.missions m
  where m.id = p_mission_id
    and (m.client_id = auth.uid() or public.is_admin());
$$;
revoke execute on function public.mission_client_amounts(uuid) from anon;

-- ---------- 3. Table transactions (montants en centimes d'euro) ----------
create type public.transaction_status as enum ('pending_capture', 'captured', 'transferred', 'failed');

create table public.transactions (
  id                       uuid primary key default gen_random_uuid(),
  mission_id               uuid not null unique references public.missions (id) on delete restrict,
  client_id                uuid not null references public.users (id),
  provider_id              uuid not null references public.users (id),
  currency                 text not null default 'eur',

  labor_amount             int not null check (labor_amount >= 0),               -- heures facturées × taux horaire
  gross_amount             int not null check (gross_amount >= 0),               -- payé par le client
  platform_fee_client      int not null check (platform_fee_client >= 0),        -- +20 % côté client
  platform_fee_provider    int not null check (platform_fee_provider >= 0),      -- −20 % côté intervenant
  net_provider_payout      int not null check (net_provider_payout >= 0),        -- transféré à l'intervenant
  materials_reimbursement  int not null default 0 check (materials_reimbursement >= 0), -- matériel, reversé à 100 %
  platform_margin          int generated always as (platform_fee_client + platform_fee_provider) stored,

  status                   public.transaction_status not null default 'pending_capture',
  stripe_payment_intent_id text,
  stripe_charge_id         text,
  stripe_transfer_id       text,
  failure_reason           text,
  created_at               timestamptz not null default now(),
  captured_at              timestamptz,
  transferred_at           timestamptz,

  -- Le split doit tomber juste au centime près
  constraint gross_is_consistent  check (gross_amount = labor_amount + platform_fee_client + materials_reimbursement),
  constraint payout_is_consistent check (net_provider_payout = labor_amount - platform_fee_provider + materials_reimbursement),
  constraint margin_is_consistent check (gross_amount - net_provider_payout = platform_fee_client + platform_fee_provider)
);
create index transactions_client_idx   on public.transactions (client_id, created_at desc);
create index transactions_provider_idx on public.transactions (provider_id, created_at desc);
create index transactions_status_idx   on public.transactions (status);

-- Table complète : admin uniquement. Écriture : validate_completion() et le serveur.
alter table public.transactions enable row level security;
create policy "transactions: admin" on public.transactions
  for select to authenticated using (public.is_admin());

-- Chaque partie lit sa propre vue, sans les frais de l'autre.
create view public.client_transactions as
  select id, mission_id, labor_amount, platform_fee_client, materials_reimbursement,
         gross_amount, status, created_at, captured_at
  from public.transactions
  where client_id = auth.uid();

create view public.provider_transactions as
  select id, mission_id, labor_amount, platform_fee_provider, materials_reimbursement,
         net_provider_payout, status, created_at, transferred_at
  from public.transactions
  where provider_id = auth.uid();

revoke all on public.client_transactions, public.provider_transactions from anon;
grant select on public.client_transactions, public.provider_transactions to authenticated;

-- ---------- Validation client : crée la transaction ----------
create or replace function public.validate_completion(p_mission_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_m          public.missions;
  v_materials  int;
  v_fee_client int;
begin
  select * into v_m from public.missions where id = p_mission_id for update;
  if v_m.id is null or v_m.client_id is distinct from auth.uid() or v_m.status <> 'awaiting_validation' then
    raise exception 'Validation impossible';
  end if;

  update public.expenses_materials set status = 'approved' where mission_id = p_mission_id;

  select coalesce(sum(amount_cents), 0) into v_materials
  from public.expenses_materials where mission_id = p_mission_id;

  update public.missions set
    material_cents  = v_materials,
    material_status = (case when v_materials > 0 then 'approved' else 'none' end)::public.material_status,
    status          = 'completed',
    validated_at    = now()
  where id = p_mission_id
  returning * into v_m;

  v_fee_client := round(v_m.labor_cents * 0.20)::int;

  insert into public.transactions (
    mission_id, client_id, provider_id, labor_amount,
    gross_amount, platform_fee_client, platform_fee_provider,
    net_provider_payout, materials_reimbursement, stripe_payment_intent_id
  ) values (
    v_m.id, v_m.client_id, v_m.worker_id, v_m.labor_cents,
    v_m.labor_cents + v_fee_client + v_materials, v_fee_client, v_m.platform_fee_cents,
    v_m.worker_payout_cents, v_materials,
    v_m.stripe_payment_intent_id
  )
  on conflict (mission_id) do nothing;
end $$;

-- ---------- 4. Engagement de déclaration des revenus (intervenant) ----------
alter table public.users
  add column if not exists income_declaration_accepted_at timestamptz;
