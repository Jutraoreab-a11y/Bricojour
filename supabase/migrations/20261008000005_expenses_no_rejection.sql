-- =====================================================================
-- Le client ne peut plus refuser une ligne de matériel imprévu.
-- Valider = accepter toute la clôture (heures + matériel).
-- En cas de désaccord, il passe par "Signaler un problème" (litige).
-- =====================================================================

drop function if exists public.validate_completion(uuid, uuid[]);

create or replace function public.validate_completion(p_mission_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_m     public.missions;
  v_total int;
begin
  select * into v_m from public.missions where id = p_mission_id for update;
  if v_m.id is null or v_m.client_id is distinct from auth.uid() or v_m.status <> 'awaiting_validation' then
    raise exception 'Validation impossible';
  end if;

  update public.expenses_materials set status = 'approved' where mission_id = p_mission_id;

  select coalesce(sum(amount_cents), 0) into v_total
  from public.expenses_materials where mission_id = p_mission_id;

  update public.missions set
    material_cents  = v_total,
    material_status = (case when v_total > 0 then 'approved' else 'none' end)::public.material_status,
    status          = 'completed',
    validated_at    = now(),
    urssaf_status   = 'pending'
  where id = p_mission_id;
end $$;
