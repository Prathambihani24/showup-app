-- ============================================================================
-- SHOWUP BASELINE SCHEMA — run on a FRESH Supabase project
-- Re-runnable: safe to execute more than once.
-- Apply: Supabase Dashboard -> SQL Editor -> paste entire file -> Run
-- ============================================================================

create extension if not exists postgis;

-- ============================================================================
-- TABLES
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Someone',
  campus text,
  area text,
  vibes text[] not null default '{}',
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_name text not null default 'Someone',
  activity text not null check (char_length(activity) between 3 and 120),
  category text not null,
  location_name text not null,
  latitude double precision not null,
  longitude double precision not null,
  location geography(point, 4326),
  campus text not null,
  time_label text,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  spots_total integer not null check (spots_total between 1 and 20),
  spots_left integer not null check (spots_left >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spots_sane check (spots_left <= spots_total)
);

create table if not exists public.plan_joins (
  plan_id uuid not null references public.plans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);

create table if not exists public.saved_plans (
  plan_id uuid not null references public.plans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);

create table if not exists public.plan_messages (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_name text not null default 'Someone',
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('spam', 'inappropriate', 'fake')),
  created_at timestamptz not null default now(),
  unique (plan_id, reporter_id)
);

create table if not exists public.expo_push_tokens (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  token text not null,
  platform text check (platform in ('ios', 'android', 'web')),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

create index if not exists idx_plans_location_gist on public.plans using gist (location);
create index if not exists idx_plans_campus_active_location on public.plans using gist (location) where is_active = true;
create index if not exists idx_plans_bvcoe_active_location on public.plans using gist (location) where is_active = true and campus = 'BVCOE Dhankawadi';
create index if not exists idx_plans_owner on public.plans (user_id, created_at desc);
create index if not exists idx_plans_campus_recent on public.plans (campus, created_at desc) where is_active = true;
create index if not exists idx_joins_user on public.plan_joins (user_id);
create index if not exists idx_saved_user on public.saved_plans (user_id);
create index if not exists idx_messages_plan on public.plan_messages (plan_id, created_at);

-- ============================================================================
-- HELPERS: updated_at + default fillers
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_plans_updated_at on public.plans;
create trigger trg_plans_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

-- Auto-create a profile for every new auth user; verify campus email domain.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domain text := lower(split_part(new.email, '@', 2));
begin
  insert into public.profiles (id, name, campus, is_verified)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      initcap(split_part(new.email, '@', 1))
    ),
    case v_domain
      when 'bvcoe.ac.in' then 'BVCOE Dhankawadi'
      when 'mitwpu.edu.in' then 'MIT WPU Kothrud'
      when 'indiraicollege.edu.in' then 'Indira College Wakad'
      when 'sinhgad.edu' then 'Sinhgad Vadgaon'
      else null
    end,
    v_domain in ('bvcoe.ac.in', 'mitwpu.edu.in', 'indiraicollege.edu.in', 'sinhgad.edu')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Fill denormalized user_name, geography point, and expiry before insert.
create or replace function public.set_plan_defaults()
returns trigger
language plpgsql
as $$
begin
  select p.name into new.user_name from public.profiles p where p.id = new.user_id;
  if new.user_name is null then
    new.user_name := 'Someone';
  end if;
  if new.location is null and new.latitude is not null and new.longitude is not null then
    new.location := st_setsrid(st_makepoint(new.longitude, new.latitude), 4326)::geography;
  end if;
  if new.starts_at is null then
    new.starts_at := now();
  end if;
  if new.expires_at is null then
    new.expires_at := now() + interval '8 hours';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_plans_defaults on public.plans;
create trigger trg_plans_defaults before insert on public.plans
  for each row execute function public.set_plan_defaults();

create or replace function public.set_message_user()
returns trigger
language plpgsql
as $$
begin
  select p.name into new.user_name from public.profiles p where p.id = new.user_id;
  if new.user_name is null then
    new.user_name := 'Someone';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_messages_user on public.plan_messages;
create trigger trg_messages_user before insert on public.plan_messages
  for each row execute function public.set_message_user();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.plan_joins enable row level security;
alter table public.saved_plans enable row level security;
alter table public.plan_messages enable row level security;
alter table public.reports enable row level security;
alter table public.expo_push_tokens enable row level security;

-- profiles: readable by signed-in users, writable only by owner
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- plans: live plans visible to all signed-in users; full history to the owner.
-- NO update/delete policies: spots and lifecycle change ONLY via RPCs below.
drop policy if exists plans_select on public.plans;
create policy plans_select on public.plans
  for select to authenticated
  using (user_id = auth.uid() or (is_active = true and expires_at > now()));

drop policy if exists plans_insert_own on public.plans;
create policy plans_insert_own on public.plans
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and is_active = true
    and spots_left = spots_total
  );

-- plan_joins: readable (who's going); writes go through join_plan() only
drop policy if exists joins_select on public.plan_joins;
create policy joins_select on public.plan_joins
  for select to authenticated using (true);

-- saved_plans: strictly owner-scoped
drop policy if exists saved_all_own on public.saved_plans;
create policy saved_all_own on public.saved_plans
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- plan_messages: readable by signed-in users; own inserts on live plans only
drop policy if exists messages_select on public.plan_messages;
create policy messages_select on public.plan_messages
  for select to authenticated using (true);

drop policy if exists messages_insert_own on public.plan_messages;
create policy messages_insert_own on public.plan_messages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.plans p
      where p.id = plan_id and p.is_active = true and p.expires_at > now()
    )
  );

-- reports: users can file their own; only admins (dashboard) read them
drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());

-- expo_push_tokens: owner-scoped
drop policy if exists push_all_own on public.expo_push_tokens;
create policy push_all_own on public.expo_push_tokens
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================================
-- RPCs: atomic plan lifecycle
-- ============================================================================

-- Join a plan: locks the row, validates, decrements, records — no race.
create or replace function public.join_plan(p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_plan public.plans;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  select * into v_plan from public.plans where id = p_plan_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_plan.user_id = v_user then
    return jsonb_build_object('ok', false, 'reason', 'own_plan');
  end if;
  if not v_plan.is_active or v_plan.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  if exists (select 1 from public.plan_joins where plan_id = p_plan_id and user_id = v_user) then
    return jsonb_build_object('ok', false, 'reason', 'already_joined');
  end if;
  if v_plan.spots_left <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'full');
  end if;

  update public.plans
     set spots_left = spots_left - 1
   where id = p_plan_id;

  insert into public.plan_joins (plan_id, user_id) values (p_plan_id, v_user);

  return jsonb_build_object('ok', true, 'spots_left', v_plan.spots_left - 1);
end;
$$;

create or replace function public.leave_plan(p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  delete from public.plan_joins
   where plan_id = p_plan_id and user_id = v_user;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_joined');
  end if;

  update public.plans
     set spots_left = least(spots_left + 1, spots_total)
   where id = p_plan_id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.cancel_plan(p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  update public.plans
     set is_active = false
   where id = p_plan_id and user_id = v_user;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_owner_or_missing');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- Housekeeping: flip expired plans inactive. Call manually, or schedule
-- with pg_cron once the pilot grows (select cron.schedule(...) daily).
create or replace function public.cleanup_expired_plans()
returns integer
language sql
security definer
set search_path = public
as $$
  with expired as (
    update public.plans set is_active = false
     where is_active = true and expires_at <= now()
    returning 1
  )
  select count(*) from expired;
$$;

-- ============================================================================
-- SPATIAL FEED QUERIES (PostGIS + expiry + viewer enrichment)
-- ============================================================================

create or replace function public.fetch_plans_near_me(
  user_lat double precision,
  user_lng double precision,
  search_radius_m integer default 5000,
  result_limit integer default 20,
  campus_name text default 'BVCOE Dhankawadi'
)
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  activity text,
  location_name text,
  latitude double precision,
  longitude double precision,
  campus text,
  category text,
  time_label text,
  starts_at timestamptz,
  spots_total integer,
  spots_left integer,
  created_at timestamptz,
  distance_m double precision,
  joined_count integer,
  is_joined boolean
)
language sql
stable
parallel safe
as $$
  select
    p.id, p.user_id, p.user_name, p.activity, p.location_name,
    p.latitude, p.longitude, p.campus, p.category, p.time_label,
    p.starts_at, p.spots_total, p.spots_left, p.created_at,
    st_distance(p.location, st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography) as distance_m,
    (select count(*)::int from public.plan_joins j where j.plan_id = p.id) as joined_count,
    exists (select 1 from public.plan_joins j where j.plan_id = p.id and j.user_id = auth.uid()) as is_joined
  from public.plans p
  where p.is_active = true
    and p.expires_at > now()
    and p.campus = campus_name
    and st_dwithin(p.location, st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography, search_radius_m)
  order by p.location <-> st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
  limit result_limit;
$$;

create or replace function public.fetch_plans_near_me_paginated(
  user_lat double precision,
  user_lng double precision,
  search_radius_m integer default 5000,
  result_limit integer default 20,
  cursor_distance_m double precision default null,
  campus_name text default 'BVCOE Dhankawadi'
)
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  activity text,
  location_name text,
  latitude double precision,
  longitude double precision,
  campus text,
  category text,
  time_label text,
  starts_at timestamptz,
  spots_total integer,
  spots_left integer,
  created_at timestamptz,
  distance_m double precision,
  joined_count integer,
  is_joined boolean
)
language sql
stable
parallel safe
as $$
  select
    p.id, p.user_id, p.user_name, p.activity, p.location_name,
    p.latitude, p.longitude, p.campus, p.category, p.time_label,
    p.starts_at, p.spots_total, p.spots_left, p.created_at,
    st_distance(p.location, st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography) as distance_m,
    (select count(*)::int from public.plan_joins j where j.plan_id = p.id) as joined_count,
    exists (select 1 from public.plan_joins j where j.plan_id = p.id and j.user_id = auth.uid()) as is_joined
  from public.plans p
  where p.is_active = true
    and p.expires_at > now()
    and p.campus = campus_name
    and st_dwithin(p.location, st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography, search_radius_m)
    and (cursor_distance_m is null
         or st_distance(p.location, st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography) > cursor_distance_m)
  order by p.location <-> st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
  limit result_limit;
$$;

create or replace function public.fetch_nearest_plans(
  user_lat double precision,
  user_lng double precision,
  result_limit integer default 10,
  campus_name text default 'BVCOE Dhankawadi'
)
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  activity text,
  location_name text,
  latitude double precision,
  longitude double precision,
  campus text,
  category text,
  time_label text,
  starts_at timestamptz,
  spots_total integer,
  spots_left integer,
  created_at timestamptz,
  distance_m double precision,
  joined_count integer,
  is_joined boolean
)
language sql
stable
parallel safe
as $$
  select
    p.id, p.user_id, p.user_name, p.activity, p.location_name,
    p.latitude, p.longitude, p.campus, p.category, p.time_label,
    p.starts_at, p.spots_total, p.spots_left, p.created_at,
    st_distance(p.location, st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography) as distance_m,
    (select count(*)::int from public.plan_joins j where j.plan_id = p.id) as joined_count,
    exists (select 1 from public.plan_joins j where j.plan_id = p.id and j.user_id = auth.uid()) as is_joined
  from public.plans p
  where p.is_active = true
    and p.expires_at > now()
    and p.campus = campus_name
  order by p.location <-> st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
  limit result_limit;
$$;

-- ============================================================================
-- REALTIME (chat) + FUNCTION GRANTS
-- ============================================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.plan_messages;
  end if;
exception
  when duplicate_object then null;
end $$;

revoke execute on function public.join_plan(uuid) from anon, public;
revoke execute on function public.leave_plan(uuid) from anon, public;
revoke execute on function public.cancel_plan(uuid) from anon, public;
revoke execute on function public.cleanup_expired_plans() from anon, authenticated, public;
grant execute on function public.join_plan(uuid), public.leave_plan(uuid), public.cancel_plan(uuid)
  to authenticated;
grant execute on function public.fetch_plans_near_me(double precision, double precision, integer, integer, text),
  public.fetch_plans_near_me_paginated(double precision, double precision, integer, integer, double precision, text),
  public.fetch_nearest_plans(double precision, double precision, integer, text)
  to authenticated;
