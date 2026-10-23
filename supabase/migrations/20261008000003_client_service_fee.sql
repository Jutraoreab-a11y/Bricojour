-- =====================================================================
-- Frais de service client : +20 % sur la main-d'œuvre, payés par le
-- client, en plus de la commission de 20 % prélevée sur l'intervenant.
-- Le matériel imprévu reste refacturé au prix coûtant (sans frais).
--
--   Exemple 2 h à 25 €/h : main-d'œuvre 50 €
--   client paie 50 + 10 = 60 €   |   intervenant reçoit 50 − 10 = 40 €
--   plateforme garde 20 € (avant frais Stripe)
-- =====================================================================

alter table public.missions drop column client_total_cents;

alter table public.missions
  add column client_fee_cents int generated always as (
    round(round(hourly_rate_cents * coalesce(actual_hours, 0)) * 0.20)::int
  ) stored,
  add column client_total_cents int generated always as (
    round(hourly_rate_cents * coalesce(actual_hours, 0))::int
    + round(round(hourly_rate_cents * coalesce(actual_hours, 0)) * 0.20)::int
    + case when material_status = 'approved' then material_cents else 0 end
  ) stored;

-- Le plafond pré-autorisé inclut désormais les frais de service
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

  v_labor := round(v_m.hourly_rate_cents * p_actual_hours);
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
