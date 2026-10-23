-- Preuve d'acceptation des conditions générales et de la demande
-- d'exécution immédiate (renonciation au droit de rétractation
-- une fois l'intervention entièrement réalisée, art. L221-28).

alter table public.missions
  add column terms_version text,
  add column terms_accepted_at timestamptz,
  add column express_execution_requested boolean not null default false;

alter table public.users
  add column terms_version text,
  add column terms_accepted_at timestamptz;
