-- =====================================================================
-- ÉTAPE 1 — Schéma Supabase : plateforme de dépannage express (jour même)
-- Exécution : `supabase db push` ou SQL Editor du dashboard Supabase.
--
-- Principes :
--   * Montants en CENTIMES (integer) → aucun arrondi flottant.
--   * Prix imposé : le tarif horaire est copié depuis la catégorie par
--     trigger, jamais fourni par le client.
--   * Les transitions d'état des missions passent UNIQUEMENT par des
--     fonctions RPC (aucune policy UPDATE directe sur `missions`).
--   * Split 20 % calculé en colonnes générées (source de vérité unique
--     pour Stripe Connect à l'étape 4).
-- =====================================================================

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------
create type public.user_role              as enum ('client', 'worker', 'admin');
create type public.kyc_status             as enum ('not_started', 'pending', 'verified', 'rejected');
create type public.worker_status          as enum ('onboarding', 'active', 'suspended');
create type public.worker_category_status as enum ('pending', 'approved', 'rejected');
create type public.mission_slot           as enum ('asap', 'morning', 'afternoon', 'evening');
create type public.mission_status         as enum (
  'pending_payment',      -- créée, en attente de pré-autorisation Stripe
  'searching',            -- paiement bloqué, diffusion aux intervenants
  'matched',              -- un intervenant a accepté
  'in_progress',          -- intervention démarrée
  'awaiting_validation',  -- heures + supplément saisis, attente client
  'completed',            -- validée par le client → capture + Urssaf
  'cancelled',
  'disputed'
);
create type public.material_status  as enum ('none', 'pending', 'approved', 'rejected');
create type public.proposal_status  as enum ('notified', 'accepted', 'declined', 'expired', 'lost');
create type public.urssaf_status    as enum ('not_applicable', 'pending', 'declared', 'failed');

-- ---------------------------------------------------------------------
-- USERS (profil applicatif, 1-1 avec auth.users)
-- ---------------------------------------------------------------------
create table public.users (
  id                 uuid primary key references auth.users (id) on delete cascade,
  role               public.user_role not null default 'client',
  full_name          text,
  phone              text,
  avatar_url         text,
  -- Intervenant
  kyc_status         public.kyc_status not null default 'not_started',
  worker_status      public.worker_status,
  base_location      extensions.geography(Point, 4326),
  service_radius_km  int not null default 10 check (service_radius_km between 1 and 50),
  is_available       boolean not null default false,
  rating_avg         numeric(3, 2) not null default 0,
  rating_count       int not null default 0,
  stripe_account_id  text unique,          -- compte Stripe Connect (intervenant)
  -- Client
  stripe_customer_id text unique,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index users_base_location_idx on public.users using gist (base_location);

-- Création automatique du profil à l'inscription (rôle admin jamais auto-attribué)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role public.user_role :=
    case new.raw_user_meta_data ->> 'role' when 'worker' then 'worker' else 'client' end;
begin
  insert into public.users (id, role, full_name, worker_status)
  values (new.id, v_role, new.raw_user_meta_data ->> 'full_name',
          case when v_role = 'worker' then 'onboarding'::public.worker_status end);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Un utilisateur ne peut pas modifier ses champs sensibles lui-même.
-- (Les fonctions SECURITY DEFINER et le service_role ne sont pas concernés.)
create or replace function public.protect_user_columns()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.role               := old.role;
    new.kyc_status         := old.kyc_status;
    new.worker_status      := old.worker_status;
    new.rating_avg         := old.rating_avg;
    new.rating_count       := old.rating_count;
    new.stripe_account_id  := old.stripe_account_id;
    new.stripe_customer_id := old.stripe_customer_id;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger users_protect_columns
  before update on public.users
  for each row execute function public.protect_user_columns();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'admin');
$$;

-- Profil public (sans téléphone ni identifiants Stripe)
create view public.public_profiles as
  select id, role, full_name, avatar_url, rating_avg, rating_count
  from public.users;

-- ---------------------------------------------------------------------
-- CATEGORIES (liste blanche : seules les lignes actives sont réservables)
-- ---------------------------------------------------------------------
create table public.categories (
  id                int generated always as identity primary key,
  slug              text not null unique,
  name              text not null,
  description       text,
  excluded_work     text,                       -- affiché au client
  icon              text,
  hourly_rate_cents int not null check (hourly_rate_cents > 0),
  max_hours         numeric(4, 2) not null default 4 check (max_hours between 0.5 and 8),
  is_active         boolean not null default true,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- ONBOARDING PAR LA PREUVE (2 photos de réalisations par catégorie)
-- ---------------------------------------------------------------------
create table public.worker_portfolio (
  id          uuid primary key default gen_random_uuid(),
  worker_id   uuid not null references public.users (id) on delete cascade,
  category_id int  not null references public.categories (id),
  photo_path  text not null,                     -- bucket "portfolio"
  caption     text check (char_length(caption) <= 300),
  created_at  timestamptz not null default now()
);
create index worker_portfolio_worker_idx on public.worker_portfolio (worker_id, category_id);

create table public.worker_categories (
  worker_id   uuid not null references public.users (id) on delete cascade,
  category_id int  not null references public.categories (id),
  status      public.worker_category_status not null default 'pending',
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  primary key (worker_id, category_id)
);

create or replace function public.check_portfolio_before_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and (
    select count(*) from public.worker_portfolio
    where worker_id = new.worker_id and category_id = new.category_id
  ) < 2 then
    raise exception 'Au moins 2 photos de réalisations sont requises pour débloquer cette catégorie';
  end if;
  if new.status is distinct from old.status then
    new.reviewed_at := now();
  end if;
  return new;
end $$;

create trigger worker_categories_check_portfolio
  before insert or update on public.worker_categories
  for each row execute function public.check_portfolio_before_approval();

-- ---------------------------------------------------------------------
-- MISSIONS
-- ---------------------------------------------------------------------
create table public.missions (
  id                       uuid primary key default gen_random_uuid(),
  client_id                uuid not null references public.users (id),
  worker_id                uuid references public.users (id),
  category_id              int  not null references public.categories (id),
  title                    text not null check (char_length(title) between 3 and 120),
  description              text check (char_length(description) <= 2000),
  address                  text not null,
  location                 extensions.geography(Point, 4326) not null,  -- 'SRID=4326;POINT(lng lat)'
  photo_paths              text[] not null default '{}'
                             check (coalesce(array_length(photo_paths, 1), 0) <= 5),
  scheduled_date           date not null default (now() at time zone 'Europe/Paris')::date,
  slot                     public.mission_slot not null default 'asap',
  status                   public.mission_status not null default 'pending_payment',

  -- Tarification (prix imposé, copié de la catégorie)
  hourly_rate_cents        int not null,
  estimated_hours          numeric(4, 2) not null default 1 check (estimated_hours > 0),
  actual_hours             numeric(4, 2)
                             check (actual_hours > 0 and actual_hours <= 8
                                    and actual_hours * 4 = floor(actual_hours * 4)), -- pas de 15 min

  -- Supplément matériel (justifié par photo, validé par le client)
  material_cents           int not null default 0 check (material_cents between 0 and 20000),
  material_photo_path      text,
  material_status          public.material_status not null default 'none',

  -- Split 20 % sur la main-d'œuvre uniquement (le matériel est reversé à 100 %)
  labor_cents              int generated always as (
                             round(hourly_rate_cents * coalesce(actual_hours, 0))::int
                           ) stored,
  platform_fee_cents       int generated always as (
                             round(round(hourly_rate_cents * coalesce(actual_hours, 0)) * 0.20)::int
                           ) stored,
  worker_payout_cents      int generated always as (
                             round(hourly_rate_cents * coalesce(actual_hours, 0))::int
                             - round(round(hourly_rate_cents * coalesce(actual_hours, 0)) * 0.20)::int
                             + case when material_status = 'approved' then material_cents else 0 end
                           ) stored,
  client_total_cents       int generated always as (
                             round(hourly_rate_cents * coalesce(actual_hours, 0))::int
                             + case when material_status = 'approved' then material_cents else 0 end
                           ) stored,

  -- Stripe (étape 4)
  stripe_payment_intent_id text unique,
  authorized_amount_cents  int,
  stripe_transfer_id       text,

  -- Urssaf / CESU (traitement asynchrone)
  urssaf_status            public.urssaf_status not null default 'not_applicable',
  urssaf_reference         text,

  created_at               timestamptz not null default now(),
  matched_at               timestamptz,
  started_at               timestamptz,
  finished_at              timestamptz,
  validated_at             timestamptz,
  cancelled_at             timestamptz,

  constraint material_requires_photo check (material_cents = 0 or material_photo_path is not null)
);
create index missions_status_idx   on public.missions (status);
create index missions_client_idx   on public.missions (client_id, created_at desc);
create index missions_worker_idx   on public.missions (worker_id, created_at desc);
create index missions_location_idx on public.missions using gist (location);

-- Contrôles à la création : liste blanche, jour même, prix imposé
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
  new.status              := 'pending_payment';
  new.worker_id           := null;
  new.actual_hours        := null;
  new.material_cents      := 0;
  new.material_photo_path := null;
  new.material_status     := 'none';
  return new;
end $$;

create trigger missions_before_insert
  before insert on public.missions
  for each row execute function public.missions_before_insert();

-- ---------------------------------------------------------------------
-- PROPOSALS (journal de diffusion "premier arrivé, premier servi")
-- Insérées par l'Edge Function de matching (service_role) à l'étape 3.
-- ---------------------------------------------------------------------
create table public.proposals (
  id           uuid primary key default gen_random_uuid(),
  mission_id   uuid not null references public.missions (id) on delete cascade,
  worker_id    uuid not null references public.users (id) on delete cascade,
  status       public.proposal_status not null default 'notified',
  distance_m   int,
  notified_at  timestamptz not null default now(),
  responded_at timestamptz,
  unique (mission_id, worker_id)
);
create index proposals_worker_idx on public.proposals (worker_id, status);

-- ---------------------------------------------------------------------
-- CHATS (éphémères : fermés 48 h après la fin du chantier)
-- ---------------------------------------------------------------------
create table public.chats (
  id         uuid primary key default gen_random_uuid(),
  mission_id uuid not null unique references public.missions (id) on delete cascade,
  client_id  uuid not null references public.users (id),
  worker_id  uuid not null references public.users (id),
  opened_at  timestamptz not null default now(),
  closes_at  timestamptz            -- null = ouvert
);

create table public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  chat_id    uuid not null references public.chats (id) on delete cascade,
  sender_id  uuid not null references public.users (id),
  body       text check (char_length(body) <= 2000),
  photo_path text,                  -- bucket "chat-photos"
  created_at timestamptz not null default now(),
  check (body is not null or photo_path is not null)
);
create index chat_messages_chat_idx on public.chat_messages (chat_id, created_at);

-- ---------------------------------------------------------------------
-- REVIEWS (+ suspension automatique)
-- ---------------------------------------------------------------------
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  mission_id  uuid not null references public.missions (id) on delete cascade,
  reviewer_id uuid not null references public.users (id),
  reviewee_id uuid not null references public.users (id),
  rating      smallint not null check (rating between 1 and 5),
  comment     text check (char_length(comment) <= 1000),
  created_at  timestamptz not null default now(),
  unique (mission_id, reviewer_id)
);
create index reviews_reviewee_idx on public.reviews (reviewee_id);

create or replace function public.reviews_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_m public.missions;
begin
  select * into v_m from public.missions where id = new.mission_id;
  if v_m.id is null or v_m.status <> 'completed' then
    raise exception 'La mission doit être terminée pour être notée';
  end if;
  if new.reviewer_id = v_m.client_id then
    new.reviewee_id := v_m.worker_id;
  elsif new.reviewer_id = v_m.worker_id then
    new.reviewee_id := v_m.client_id;
  else
    raise exception 'Accès refusé';
  end if;
  return new;
end $$;

create trigger reviews_before_insert
  before insert on public.reviews
  for each row execute function public.reviews_before_insert();

create or replace function public.reviews_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c_min_reviews constant int     := 5;    -- évite une suspension sur 1 seul avis
  c_threshold   constant numeric := 4.0;  -- seuil critique du cahier des charges
  v_avg numeric;
  v_cnt int;
  v_suspend boolean;
begin
  if not exists (select 1 from public.users where id = new.reviewee_id and role = 'worker') then
    return null;
  end if;

  select avg(rating), count(*) into v_avg, v_cnt
  from public.reviews where reviewee_id = new.reviewee_id;

  v_suspend := v_cnt >= c_min_reviews and v_avg < c_threshold;

  update public.users set
    rating_avg    = round(v_avg, 2),
    rating_count  = v_cnt,
    worker_status = case when v_suspend then 'suspended'::public.worker_status else worker_status end,
    is_available  = case when v_suspend then false else is_available end
  where id = new.reviewee_id;
  return null;
end $$;

create trigger reviews_after_insert
  after insert on public.reviews
  for each row execute function public.reviews_after_insert();

-- ---------------------------------------------------------------------
-- PUSH SUBSCRIPTIONS (Web Push API)
-- ---------------------------------------------------------------------
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------
-- Fermeture du chat selon le statut de la mission
-- ---------------------------------------------------------------------
create or replace function public.missions_after_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' then
    update public.chats set closes_at = now() + interval '48 hours' where mission_id = new.id;
  elsif new.status = 'cancelled' then
    update public.chats set closes_at = now() where mission_id = new.id;
  end if;
  return null;
end $$;

create trigger missions_status_change
  after update of status on public.missions
  for each row when (old.status is distinct from new.status)
  execute function public.missions_after_status_change();

-- =====================================================================
-- RPC MÉTIER (appelées via supabase.rpc(...))
-- =====================================================================

-- Acceptation atomique : le verrou FOR UPDATE garantit qu'un seul
-- intervenant remporte la mission, même avec des clics simultanés.
create or replace function public.accept_mission(p_mission_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_m   public.missions;
begin
  if not exists (
    select 1 from public.users
    where id = v_uid and role = 'worker' and worker_status = 'active' and kyc_status = 'verified'
  ) then
    raise exception 'Compte intervenant non actif';
  end if;

  select * into v_m from public.missions where id = p_mission_id for update;
  if v_m.id is null then
    raise exception 'Mission introuvable';
  end if;

  if not exists (
    select 1 from public.proposals
    where mission_id = p_mission_id and worker_id = v_uid and status = 'notified'
  ) then
    raise exception 'Cette mission ne vous a pas été proposée';
  end if;

  if v_m.status <> 'searching' then
    update public.proposals set status = 'lost', responded_at = now()
    where mission_id = p_mission_id and worker_id = v_uid;
    return false;  -- déjà prise par quelqu'un d'autre
  end if;

  update public.missions
  set worker_id = v_uid, status = 'matched', matched_at = now()
  where id = p_mission_id;

  update public.proposals
  set status = case when worker_id = v_uid then 'accepted'::public.proposal_status
                    else 'lost'::public.proposal_status end,
      responded_at = now()
  where mission_id = p_mission_id and status = 'notified';

  insert into public.chats (mission_id, client_id, worker_id)
  values (p_mission_id, v_m.client_id, v_uid)
  on conflict (mission_id) do nothing;

  return true;
end $$;

create or replace function public.decline_mission(p_mission_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.proposals set status = 'declined', responded_at = now()
  where mission_id = p_mission_id and worker_id = auth.uid() and status = 'notified';
end $$;

create or replace function public.start_mission(p_mission_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.missions set status = 'in_progress', started_at = now()
  where id = p_mission_id and worker_id = auth.uid() and status = 'matched';
  if not found then
    raise exception 'Impossible de démarrer cette mission';
  end if;
end $$;

-- Clôture côté intervenant : heures réelles + supplément matériel éventuel
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

-- Validation côté client (le "swipe") → déclenche capture Stripe + Urssaf
create or replace function public.validate_completion(
  p_mission_id       uuid,
  p_approve_material boolean default true
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_m public.missions;
begin
  select * into v_m from public.missions where id = p_mission_id for update;
  if v_m.id is null or v_m.client_id is distinct from auth.uid() or v_m.status <> 'awaiting_validation' then
    raise exception 'Validation impossible';
  end if;

  update public.missions set
    material_status = case
      when material_status = 'pending' and p_approve_material then 'approved'::public.material_status
      when material_status = 'pending' then 'rejected'::public.material_status
      else material_status end,
    status        = 'completed',
    validated_at  = now(),
    urssaf_status = 'pending'
  where id = p_mission_id;
end $$;

create or replace function public.dispute_completion(p_mission_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.missions set status = 'disputed'
  where id = p_mission_id and client_id = auth.uid() and status = 'awaiting_validation';
  if not found then
    raise exception 'Contestation impossible';
  end if;
end $$;

create or replace function public.cancel_mission(p_mission_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.missions set status = 'cancelled', cancelled_at = now()
  where id = p_mission_id and client_id = auth.uid()
    and status in ('pending_payment', 'searching');
  if not found then
    raise exception 'Annulation impossible à ce stade';
  end if;
  update public.proposals set status = 'expired', responded_at = now()
  where mission_id = p_mission_id and status = 'notified';
end $$;

-- Intervenants éligibles (utilisée par l'Edge Function de matching, étape 3)
create or replace function public.eligible_workers(p_mission_id uuid)
returns table (worker_id uuid, distance_m int)
language sql stable security definer set search_path = public, extensions as $$
  select u.id, round(st_distance(u.base_location, m.location))::int
  from public.missions m
  join public.worker_categories wc on wc.category_id = m.category_id and wc.status = 'approved'
  join public.users u on u.id = wc.worker_id
  where m.id = p_mission_id
    and m.status = 'searching'
    and u.role = 'worker'
    and u.worker_status = 'active'
    and u.kyc_status = 'verified'
    and u.is_available
    and u.id <> m.client_id
    and u.base_location is not null
    and st_dwithin(u.base_location, m.location, u.service_radius_km * 1000)
  order by 2;
$$;
revoke execute on function public.eligible_workers(uuid) from public, anon, authenticated;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.users              enable row level security;
alter table public.categories         enable row level security;
alter table public.worker_portfolio   enable row level security;
alter table public.worker_categories  enable row level security;
alter table public.missions           enable row level security;
alter table public.proposals          enable row level security;
alter table public.chats              enable row level security;
alter table public.chat_messages      enable row level security;
alter table public.reviews            enable row level security;
alter table public.push_subscriptions enable row level security;

-- users
create policy "users: lecture de son profil" on public.users
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "users: mise à jour de son profil" on public.users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
grant select on public.public_profiles to authenticated;

-- categories (catalogue public)
create policy "categories: lecture publique" on public.categories
  for select to anon, authenticated using (is_active or public.is_admin());
create policy "categories: gestion admin" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- worker_portfolio
create policy "portfolio: lecture" on public.worker_portfolio
  for select to authenticated using (true);
create policy "portfolio: ajout par l'intervenant" on public.worker_portfolio
  for insert to authenticated with check (worker_id = auth.uid());
create policy "portfolio: suppression par l'intervenant" on public.worker_portfolio
  for delete to authenticated using (worker_id = auth.uid());

-- worker_categories (l'intervenant demande, l'admin approuve)
create policy "worker_categories: lecture" on public.worker_categories
  for select to authenticated using (worker_id = auth.uid() or public.is_admin());
create policy "worker_categories: demande" on public.worker_categories
  for insert to authenticated with check (worker_id = auth.uid() and status = 'pending');
create policy "worker_categories: validation admin" on public.worker_categories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- missions (aucune policy UPDATE/DELETE : transitions via RPC uniquement)
create policy "missions: lecture" on public.missions
  for select to authenticated using (
    client_id = auth.uid()
    or worker_id = auth.uid()
    or exists (select 1 from public.proposals p
               where p.mission_id = missions.id and p.worker_id = auth.uid())
    or public.is_admin()
  );
create policy "missions: création par le client" on public.missions
  for insert to authenticated with check (client_id = auth.uid());

-- proposals
create policy "proposals: lecture par l'intervenant" on public.proposals
  for select to authenticated using (worker_id = auth.uid() or public.is_admin());

-- chats
create policy "chats: participants" on public.chats
  for select to authenticated using (client_id = auth.uid() or worker_id = auth.uid());

-- chat_messages
create policy "messages: lecture participants" on public.chat_messages
  for select to authenticated using (
    exists (select 1 from public.chats c
            where c.id = chat_messages.chat_id
              and (c.client_id = auth.uid() or c.worker_id = auth.uid()))
  );
create policy "messages: envoi si chat ouvert" on public.chat_messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and exists (select 1 from public.chats c
                where c.id = chat_messages.chat_id
                  and (c.client_id = auth.uid() or c.worker_id = auth.uid())
                  and (c.closes_at is null or c.closes_at > now()))
  );

-- reviews
create policy "reviews: lecture" on public.reviews
  for select to authenticated using (true);
create policy "reviews: dépôt" on public.reviews
  for insert to authenticated with check (reviewer_id = auth.uid());

-- push_subscriptions
create policy "push: gestion de ses abonnements" on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =====================================================================
-- REALTIME (respecte la RLS)
-- =====================================================================
alter publication supabase_realtime add table public.missions, public.proposals, public.chat_messages;

-- =====================================================================
-- STORAGE (buckets privés, chemin = <user_id>/<fichier>)
-- Les accès croisés (client ↔ intervenant) passent par des URLs signées
-- générées côté serveur.
-- =====================================================================
insert into storage.buckets (id, name, public) values
  ('mission-photos',    'mission-photos',    false),
  ('portfolio',         'portfolio',         false),
  ('material-receipts', 'material-receipts', false),
  ('chat-photos',       'chat-photos',       false)
on conflict (id) do nothing;

create policy "storage: upload dans son dossier" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('mission-photos', 'portfolio', 'material-receipts', 'chat-photos')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "storage: lecture de ses fichiers" on storage.objects
  for select to authenticated using (
    bucket_id in ('mission-photos', 'portfolio', 'material-receipts', 'chat-photos')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "storage: suppression de ses fichiers" on storage.objects
  for delete to authenticated using (
    bucket_id in ('mission-photos', 'portfolio', 'material-receipts', 'chat-photos')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================================
-- SEED : catalogue liste blanche (travaux à bas risque uniquement)
-- =====================================================================
insert into public.categories (slug, name, description, excluded_work, icon, hourly_rate_cents, max_hours, sort_order) values
  ('sols-parquet', 'Sols & parquet',
   'Lame de parquet décollée, plinthes, petite réparation de revêtement.',
   'Pose complète de sol, ponçage de pièce entière, chape.', 'layers', 2500, 4, 1),
  ('plomberie-surface', 'Plomberie de surface',
   'Joint, flexible, siphon, chasse d''eau, robinet à remplacer.',
   'Intervention sur colonne, gaz, chauffe-eau, réseau encastré.', 'droplet', 2500, 3, 2),
  ('fixation-montage', 'Fixation & montage',
   'Montage de meuble, étagère, tringle, cadre, support TV.',
   'Travaux en hauteur > 3 m, mur porteur, cloison.', 'wrench', 2500, 4, 3),
  ('electricite-cosmetique', 'Électricité cosmétique',
   'Remplacement à l''identique : luminaire, interrupteur, prise (courant coupé).',
   'Tableau électrique, création de circuit, mise aux normes.', 'lightbulb', 2500, 2, 4);
