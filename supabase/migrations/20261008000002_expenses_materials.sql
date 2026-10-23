-- =====================================================================
-- Cahier des charges v2 : bloc "Matériel imprévu" multi-lignes
-- (libellé + montant + photo obligatoire), remboursé à 100 % à
-- l'intervenant, validé ligne par ligne par le client.
-- =====================================================================

create type public.expense_status as enum ('pending', 'approved', 'rejected');

create table public.expenses_materials (
  id           uuid primary key default gen_random_uuid(),
  mission_id   uuid not null references public.missions (id) on delete cascade,
  worker_id    uuid not null references public.users (id),
  label        text not null check (char_length(label) between 2 and 120),
  amount_cents int  not null check (amount_cents between 1 and 20000),
  photo_path   text not null,                    -- bucket "material-receipts"
  status       public.expense_status not null default 'pending',
  created_at   timestamptz not null default now()
);
create index expenses_materials_mission_idx on public.expenses_materials (mission_id);

alter table public.expenses_materials enable row level security;

-- Lecture : intervenant de la mission, client de la mission, admin.
-- Écriture : uniquement via submit_completion / validate_completion.
create policy "expenses: lecture" on public.expenses_materials
  for select to authenticated using (
    worker_id = auth.uid()
    or exists (select 1 from public.missions m
               where m.id = expenses_materials.mission_id and m.client_id = auth.uid())
    or public.is_admin()
  );

-- Grille tarifaire v2 (25 €/h partout, libellés du cahier des charges)
update public.categories set hourly_rate_cents = 2500,
  description = 'Lame décollée, plinthes, petite réparation.' where slug = 'sols-parquet';
update public.categories set hourly_rate_cents = 2500,
  description = 'Joint, siphon, flexible, robinet.' where slug = 'plomberie-surface';
update public.categories set hourly_rate_cents = 2500,
  description = 'Meuble, étagère, tringle, support TV.' where slug = 'fixation-montage';
update public.categories set hourly_rate_cents = 2500,
  description = 'Luminaire, prise, interrupteur à l''identique.' where slug = 'electricite-cosmetique';

-- ---------------------------------------------------------------------
-- Clôture côté intervenant : heures + liste de matériels imprévus
-- p_expenses = [{"label": "...", "amount_cents": 1250, "photo_path": "<uid>/x.jpg"}, ...]
-- ---------------------------------------------------------------------
drop function if exists public.submit_completion(uuid, numeric, int, text);

create or replace function public.submit_completion(
  p_mission_id   uuid,
  p_actual_hours numeric,
  p_expenses     jsonb default '[]'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_m      public.missions;
  v_max    numeric;
  v_list   jsonb := coalesce(p_expenses, '[]'::jsonb);
  v_e      jsonb;
  v_label  text;
  v_amount int;
  v_photo  text;
  v_total  int := 0;
  v_first  text;
begin
  select * into v_m from public.missions where id = p_mission_id for update;
  if v_m.id is null or v_m.worker_id is distinct from auth.uid() or v_m.status <> 'in_progress' then
    raise exception 'Clôture impossible';
  end if;

  select max_hours into v_max from public.categories where id = v_m.category_id;
  if p_actual_hours is null or p_actual_hours <= 0 or p_actual_hours > v_max then
    raise exception 'Durée invalide (maximum % h)', v_max;
  end if;

  if jsonb_typeof(v_list) <> 'array' or jsonb_array_length(v_list) > 10 then
    raise exception 'Liste de matériel invalide (10 lignes maximum)';
  end if;

  delete from public.expenses_materials where mission_id = p_mission_id;

  for v_e in select value from jsonb_array_elements(v_list) loop
    v_label  := btrim(v_e ->> 'label');
    v_amount := nullif(v_e ->> 'amount_cents', '')::int;
    v_photo  := v_e ->> 'photo_path';
    if v_label is null or char_length(v_label) < 2 then
      raise exception 'Chaque matériel doit avoir un libellé';
    end if;
    if v_amount is null or v_amount <= 0 then
      raise exception 'Montant invalide pour « % »', v_label;
    end if;
    if v_photo is null or v_photo not like auth.uid()::text || '/%' then
      raise exception 'Photo du ticket obligatoire pour « % »', v_label;
    end if;

    insert into public.expenses_materials (mission_id, worker_id, label, amount_cents, photo_path)
    values (p_mission_id, auth.uid(), left(v_label, 120), v_amount, v_photo);

    v_total := v_total + v_amount;
    v_first := coalesce(v_first, v_photo);
  end loop;

  if v_total > 20000 then
    raise exception 'Le matériel imprévu ne peut pas dépasser 200 € par mission';
  end if;
  if v_m.authorized_amount_cents is not null
     and round(v_m.hourly_rate_cents * p_actual_hours) + v_total > v_m.authorized_amount_cents then
    raise exception 'Le total dépasse le montant bloqué sur la carte du client (% €)',
      round(v_m.authorized_amount_cents / 100.0, 2);
  end if;

  update public.missions set
    actual_hours        = p_actual_hours,
    material_cents      = v_total,
    material_photo_path = v_first,
    material_status     = (case when v_total > 0 then 'pending' else 'none' end)::public.material_status,
    status              = 'awaiting_validation',
    finished_at         = now()
  where id = p_mission_id;
end $$;

-- ---------------------------------------------------------------------
-- Validation client : toutes les lignes sont acceptées sauf celles
-- passées dans p_rejected_ids. Le matériel accepté est remboursé à 100 %.
-- ---------------------------------------------------------------------
drop function if exists public.validate_completion(uuid, boolean);

create or replace function public.validate_completion(
  p_mission_id   uuid,
  p_rejected_ids uuid[] default '{}'
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_m        public.missions;
  v_approved int;
  v_rejected int;
begin
  select * into v_m from public.missions where id = p_mission_id for update;
  if v_m.id is null or v_m.client_id is distinct from auth.uid() or v_m.status <> 'awaiting_validation' then
    raise exception 'Validation impossible';
  end if;

  update public.expenses_materials
  set status = (case when id = any (coalesce(p_rejected_ids, '{}')) then 'rejected' else 'approved' end)::public.expense_status
  where mission_id = p_mission_id;

  select coalesce(sum(amount_cents) filter (where status = 'approved'), 0),
         count(*) filter (where status = 'rejected')
  into v_approved, v_rejected
  from public.expenses_materials where mission_id = p_mission_id;

  update public.missions set
    material_cents  = case when v_approved > 0 then v_approved else material_cents end,
    material_status = (case
                        when v_approved > 0 then 'approved'
                        when v_rejected > 0 then 'rejected'
                        else 'none' end)::public.material_status,
    status          = 'completed',
    validated_at    = now(),
    urssaf_status   = 'pending'
  where id = p_mission_id;
end $$;

-- Lecture des justificatifs : ajoute les tickets des lignes de matériel
create or replace function public.can_read_object(p_bucket text, p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select case p_bucket
    when 'mission-photos' then exists (
      select 1 from public.missions m
      where p_name = any (m.photo_paths)
        and (m.client_id = auth.uid() or m.worker_id = auth.uid()
             or exists (select 1 from public.proposals p
                        where p.mission_id = m.id and p.worker_id = auth.uid())))
    when 'material-receipts' then exists (
      select 1 from public.expenses_materials e
      join public.missions m on m.id = e.mission_id
      where e.photo_path = p_name
        and (m.client_id = auth.uid() or m.worker_id = auth.uid()))
    when 'chat-photos' then exists (
      select 1 from public.chat_messages cm
      join public.chats c on c.id = cm.chat_id
      where cm.photo_path = p_name
        and (c.client_id = auth.uid() or c.worker_id = auth.uid()))
    when 'portfolio' then public.is_admin()
    else false
  end;
$$;
