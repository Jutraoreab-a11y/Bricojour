-- =====================================================================
-- Compléments applicatifs : lecture partagée des photos, plafond de
-- paiement pré-autorisé, droits du service_role.
-- =====================================================================

-- Qui peut lire quel fichier (client, intervenant, admin)
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
      select 1 from public.missions m
      where m.material_photo_path = p_name
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

create policy "storage: lecture liée à une mission" on storage.objects
  for select to authenticated using (
    bucket_id in ('mission-photos', 'material-receipts', 'chat-photos', 'portfolio')
    and public.can_read_object(bucket_id, name)
  );

-- Clôture : le total ne peut pas dépasser le montant bloqué sur la carte
create or replace function public.submit_completion(
  p_mission_id          uuid,
  p_actual_hours        numeric,
  p_material_cents      int  default 0,
  p_material_photo_path text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_m   public.missions;
  v_max numeric;
begin
  select * into v_m from public.missions where id = p_mission_id for update;
  if v_m.id is null or v_m.worker_id is distinct from auth.uid() or v_m.status <> 'in_progress' then
    raise exception 'Clôture impossible';
  end if;

  select max_hours into v_max from public.categories where id = v_m.category_id;
  if p_actual_hours > v_max then
    raise exception 'Durée supérieure au maximum autorisé pour cette catégorie (% h)', v_max;
  end if;
  if coalesce(p_material_cents, 0) > 0 and p_material_photo_path is null then
    raise exception 'Une photo justificative est obligatoire pour le supplément matériel';
  end if;
  if v_m.authorized_amount_cents is not null
     and round(v_m.hourly_rate_cents * p_actual_hours) + coalesce(p_material_cents, 0)
         > v_m.authorized_amount_cents then
    raise exception 'Le total dépasse le montant bloqué sur la carte du client (% €)',
      round(v_m.authorized_amount_cents / 100.0, 2);
  end if;

  update public.missions set
    actual_hours        = p_actual_hours,
    material_cents      = coalesce(p_material_cents, 0),
    material_photo_path = p_material_photo_path,
    material_status     = case when coalesce(p_material_cents, 0) > 0
                               then 'pending'::public.material_status
                               else 'none'::public.material_status end,
    status              = 'awaiting_validation',
    finished_at         = now()
  where id = p_mission_id;
end $$;

grant execute on function public.eligible_workers(uuid) to service_role;
