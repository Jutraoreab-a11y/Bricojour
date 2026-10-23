-- =====================================================================
-- Cahier des charges v3
--  1. Double prélèvement 20 % ventilé en interne : 10 % frais de dossier
--     (mise en relation) + 10 % frais de procédure déclarative, côté client
--     ET côté intervenant. Affichage unique : "Frais de service et gestion
--     administrative".
--  2. Minimum de facturation : 1 h par défaut (réglable par catégorie).
--  3. Confidentialité : un intervenant simplement alerté ne voit plus
--     l'adresse exacte, seulement code postal + ville, jusqu'à l'acceptation.
-- =====================================================================

-- ---------- Minimum de facturation ----------
alter table public.categories
  add column min_billed_hours numeric(4, 2) not null default 1 check (min_billed_hours between 0.25 and 4);

alter table public.missions
  add column min_billed_hours numeric(4, 2) not null default 1,
  add column area_label text;   -- "69003 Lyon" : seule localisation visible avant acceptation

-- ---------- Recalcul des montants (colonnes générées) ----------
alter table public.missions
  drop column labor_cents,
  drop column platform_fee_cents,
  drop column worker_payout_cents,
  drop column client_fee_cents,
  drop column client_total_cents;

alter table public.missions
  add column billed_hours numeric(4, 2) generated always as (
    case when actual_hours is null then null else greatest(actual_hours, min_billed_hours) end
  ) stored,
  add column labor_cents int generated always as (round(hourly_rate_cents * (case when actual_hours is null then 0 else greatest(actual_hours, min_billed_hours) end))::int) stored,

  -- Retenue intervenant : 20 % = 10 % dossier + 10 % déclaratif
  add column platform_fee_cents int generated always as (round(round(hourly_rate_cents * (case when actual_hours is null then 0 else greatest(actual_hours, min_billed_hours) end)) * 0.20)::int) stored,
  add column worker_fee_dossier_cents int generated always as (round(round(hourly_rate_cents * (case when actual_hours is null then 0 else greatest(actual_hours, min_billed_hours) end)) * 0.20)::int - round(round(hourly_rate_cents * (case when actual_hours is null then 0 else greatest(actual_hours, min_billed_hours) end)) * 0.20)::int / 2) stored,
  add column worker_fee_declaratif_cents int generated always as (round(round(hourly_rate_cents * (case when actual_hours is null then 0 else greatest(actual_hours, min_billed_hours) end)) * 0.20)::int / 2) stored,

  -- Majoration client : 20 % = 10 % dossier + 10 % déclaratif
  add column client_fee_cents int generated always as (round(round(hourly_rate_cents * (case when actual_hours is null then 0 else greatest(actual_hours, min_billed_hours) end)) * 0.20)::int) stored,
  add column client_fee_dossier_cents int generated always as (round(round(hourly_rate_cents * (case when actual_hours is null then 0 else greatest(actual_hours, min_billed_hours) end)) * 0.20)::int - round(round(hourly_rate_cents * (case when actual_hours is null then 0 else greatest(actual_hours, min_billed_hours) end)) * 0.20)::int / 2) stored,
  add column client_fee_declaratif_cents int generated always as (round(round(hourly_rate_cents * (case when actual_hours is null then 0 else greatest(actual_hours, min_billed_hours) end)) * 0.20)::int / 2) stored,

  -- Totaux (matériel accepté remboursé au centime, sans commission)
  add column worker_payout_cents int generated always as (round(hourly_rate_cents * (case when actual_hours is null then 0 else greatest(actual_hours, min_billed_hours) end))::int - round(round(hourly_rate_cents * (case when actual_hours is null then 0 else greatest(actual_hours, min_billed_hours) end)) * 0.20)::int + (case when material_status = 'approved' then material_cents else 0 end)) stored,
  add column client_total_cents int generated always as (round(hourly_rate_cents * (case when actual_hours is null then 0 else greatest(actual_hours, min_billed_hours) end))::int + round(round(hourly_rate_cents * (case when actual_hours is null then 0 else greatest(actual_hours, min_billed_hours) end)) * 0.20)::int + (case when material_status = 'approved' then material_cents else 0 end)) stored;

comment on column public.missions.worker_fee_dossier_cents is 'Part "frais de dossier / mise en relation" de la retenue intervenant (10 %)';
comment on column public.missions.worker_fee_declaratif_cents is 'Part "frais de procédure déclarative" de la retenue intervenant (10 %)';
comment on column public.missions.client_fee_dossier_cents is 'Part "frais de dossier / mise en relation" de la majoration client (10 %)';
comment on column public.missions.client_fee_declaratif_cents is 'Part "frais de procédure déclarative" de la majoration client (10 %)';

-- ---------- Création : snapshot du minimum + zone approximative ----------
create or replace function public.missions_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_cat public.categories;
begin
  select * into v_cat from public.categories where id = new.category_id;
  if v_cat.id is null or not v_cat.is_active then
    raise exception 'Catégorie non autorisée';
  end if;
  if new.scheduled_date <> (now() at time zone 'Europe/Paris')::date then
    raise exception 'Seules les interventions le jour même sont acceptées';
  end if;
  if new.estimated_hours > v_cat.max_hours then
    raise exception 'Durée estimée supérieure au maximum de la catégorie (% h)', v_cat.max_hours;
  end if;

  new.client_id           := coalesce(auth.uid(), new.client_id);
  new.hourly_rate_cents   := v_cat.hourly_rate_cents;
  new.min_billed_hours    := v_cat.min_billed_hours;
  new.estimated_hours     := greatest(new.estimated_hours, v_cat.min_billed_hours);
  new.area_label          := coalesce(substring(new.address from '(\d{5}\s+.+)$'), 'Zone communiquée après acceptation');
  new.status              := 'pending_payment';
  new.worker_id           := null;
  new.actual_hours        := null;
  new.material_cents      := 0;
  new.material_photo_path := null;
  new.material_status     := 'none';
  return new;
end $$;

update public.missions
set area_label = coalesce(substring(address from '(\d{5}\s+.+)$'), 'Zone communiquée après acceptation')
where area_label is null;

-- ---------- Clôture : plafond calculé sur les heures facturées ----------
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
  v_labor  int;
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

  v_labor := round(v_m.hourly_rate_cents * greatest(p_actual_hours, v_m.min_billed_hours));
  if v_m.authorized_amount_cents is not null
     and v_labor + round(v_labor * 0.20) + v_total > v_m.authorized_amount_cents then
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

-- ---------- Confidentialité ----------
-- Un intervenant alerté ne lit plus la ligne mission (adresse, GPS) :
-- il passe par my_offers(), qui n'expose que la zone approximative.
drop policy "missions: lecture" on public.missions;
create policy "missions: lecture" on public.missions
  for select to authenticated using (
    client_id = auth.uid() or worker_id = auth.uid() or public.is_admin()
  );

create or replace function public.my_offers()
returns table (
  mission_id        uuid,
  title             text,
  category_name     text,
  area_label        text,
  distance_m        int,
  estimated_hours   numeric,
  hourly_rate_cents int,
  min_billed_hours  numeric,
  slot              public.mission_slot,
  photo_paths       text[],
  notified_at       timestamptz
)
language sql stable security definer set search_path = public as $$
  select m.id, m.title, c.name, m.area_label, p.distance_m, m.estimated_hours,
         m.hourly_rate_cents, m.min_billed_hours, m.slot, m.photo_paths, p.notified_at
  from public.proposals p
  join public.missions m   on m.id = p.mission_id
  join public.categories c on c.id = m.category_id
  where p.worker_id = auth.uid()
    and p.status = 'notified'
    and m.status = 'searching'
  order by p.notified_at desc;
$$;
revoke execute on function public.my_offers() from anon;
