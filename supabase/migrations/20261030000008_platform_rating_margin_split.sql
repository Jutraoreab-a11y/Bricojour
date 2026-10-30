-- =====================================================================
-- 30/10/2026
--  1. Note moyenne publique des intervenants, calculée sur les vrais avis
--     (la landing n'affiche jamais de note inventée).
--  2. Ventilation INTERNE de la marge plateforme : 10 % frais de connexion /
--     mise en relation + 10 % facilitation administrative, de chaque côté.
--     Comptabilité uniquement : absent des vues client et intervenant.
--     Le matériel imprévu reste hors marge (prix coûtant, sans commission).
-- =====================================================================

create or replace function public.platform_rating()
returns table (rating_avg numeric, rating_count int)
language sql stable security definer set search_path = public as $$
  select round(avg(r.rating)::numeric, 1), count(*)::int
  from public.reviews r
  join public.users u on u.id = r.reviewee_id
  where u.role = 'worker';
$$;
grant execute on function public.platform_rating() to anon, authenticated;

-- Une colonne générée ne peut pas en lire une autre : on repart des montants de base.
alter table public.transactions
  add column margin_connection_fee int generated always as (
    (platform_fee_client + platform_fee_provider) - (platform_fee_client + platform_fee_provider) / 2
  ) stored,
  add column margin_admin_facilitation int generated always as (
    (platform_fee_client + platform_fee_provider) / 2
  ) stored;

comment on column public.transactions.margin_connection_fee     is 'Interne : part « frais de connexion / mise en relation » de la marge (10 % client + 10 % intervenant)';
comment on column public.transactions.margin_admin_facilitation is 'Interne : part « facilitation administrative » de la marge (10 % client + 10 % intervenant)';
