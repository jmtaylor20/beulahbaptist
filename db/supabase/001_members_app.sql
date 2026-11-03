-- Beulah Baptist members app: schema, row-level security, storage.
-- Applied to Supabase project beulah-baptist-app (wknfrawtizirxsaldwlp) on 2026-11-03. Keep this file in sync with
-- the live database; later changes go in 002_, 003_, and so on.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Households and people
-- ---------------------------------------------------------------------------

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,                      -- "The Taylor Family"
  address text,
  city text,
  state text default 'AL',
  zip text,
  home_phone text,
  anniversary date,
  photo_path text,                         -- storage path in member-photos
  admin_notes text,                        -- church office only
  created_at timestamptz not null default now()
);

create type person_status as enum ('pending', 'active', 'inactive', 'declined');
create type household_role as enum ('head', 'spouse', 'child', 'other');
create type field_visibility as enum ('members', 'church');

create table people (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  household_id uuid references households (id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  birthday date,
  role household_role not null default 'other',
  is_minor boolean not null default false,
  photo_path text,
  bio text,
  -- What other members may see. The church office always sees everything.
  show_email field_visibility not null default 'church',
  show_phone field_visibility not null default 'church',
  show_birthday field_visibility not null default 'church',
  show_address field_visibility not null default 'church',
  bible_translation text not null default 'KJV',
  status person_status not null default 'pending',
  is_admin boolean not null default false,
  request_note text,                       -- what they wrote when requesting access
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index people_household_idx on people (household_id);
create index people_last_name_idx on people (last_name, first_name);

-- ---------------------------------------------------------------------------
-- Announcements, serving sign-ups, events
-- ---------------------------------------------------------------------------

create type content_status as enum ('suggested', 'draft', 'approved', 'archived');
create type announcement_kind as enum ('announcement', 'serving');

create table announcements (
  id uuid primary key default gen_random_uuid(),
  kind announcement_kind not null default 'announcement',
  title text not null,
  body text,                               -- the approved, polished text
  body_original text,                      -- what was submitted, kept for reference
  image_path text,                         -- storage path in public-media
  link_url text,
  starts_on date,                          -- when it becomes relevant
  ends_on date,                            -- drop from app and email after this
  status content_status not null default 'draft',
  submitted_by uuid references people (id) on delete set null,
  slots integer,                           -- serving: how many people are needed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table serving_signups (
  announcement_id uuid not null references announcements (id) on delete cascade,
  person_id uuid not null references people (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  primary key (announcement_id, person_id)
);

create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  image_path text,
  rsvp_enabled boolean not null default false,
  status content_status not null default 'draft',
  submitted_by uuid references people (id) on delete set null,
  created_at timestamptz not null default now()
);
create index events_starts_idx on events (starts_at);

create table event_rsvps (
  event_id uuid not null references events (id) on delete cascade,
  person_id uuid not null references people (id) on delete cascade,
  headcount integer not null default 1,
  created_at timestamptz not null default now(),
  primary key (event_id, person_id)
);

-- ---------------------------------------------------------------------------
-- Prayer requests
-- ---------------------------------------------------------------------------

create type prayer_audience as enum ('church', 'pastor');

create table prayer_requests (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people (id) on delete cascade,
  body text not null,
  audience prayer_audience not null default 'church',
  newsletter_ok boolean not null default false,
  answered_at timestamptz,
  answered_note text,
  created_at timestamptz not null default now()
);

create table prayer_responses (                 -- "I prayed"
  prayer_id uuid not null references prayer_requests (id) on delete cascade,
  person_id uuid not null references people (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (prayer_id, person_id)
);

-- ---------------------------------------------------------------------------
-- Forms and newsletters
-- ---------------------------------------------------------------------------

create table form_submissions (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                      -- visitor, membership, benevolence, facility
  person_id uuid references people (id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create table newsletters (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  template text not null default 'classic',
  intro text,
  announcement_ids uuid[] not null default '{}',
  event_ids uuid[] not null default '{}',
  include_birthdays boolean not null default true,
  include_serving boolean not null default true,
  html text,
  sent_at timestamptz,
  recipient_count integer,
  created_by uuid references people (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers used by policies
-- ---------------------------------------------------------------------------

create or replace function current_person_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from people where auth_user_id = auth.uid()
$$;

create or replace function is_active_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from people where auth_user_id = auth.uid() and status = 'active')
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from people where auth_user_id = auth.uid() and status = 'active' and is_admin)
$$;

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger people_touch before update on people for each row execute function touch_updated_at();
create trigger announcements_touch before update on announcements for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Directory view: what members see of each other. Fields the person set to
-- "church" come through as null. Admins read the people table directly.
-- The view deliberately runs as its owner (Supabase's linter flags this as a
-- "security definer view"): members only have row access to their own people
-- row, and the view is the one sanctioned way to see everyone else, already
-- masked and limited to active members.
-- ---------------------------------------------------------------------------

create view directory as
select
  p.id, p.household_id, p.first_name, p.last_name, p.role, p.is_minor, p.photo_path, p.bio,
  case when p.show_email = 'members' then p.email end as email,
  case when p.show_phone = 'members' then p.phone end as phone,
  case when p.show_birthday = 'members' then p.birthday end as birthday,
  h.name as household_name,
  case when p.show_address = 'members' then h.address end as address,
  case when p.show_address = 'members' then h.city end as city,
  case when p.show_address = 'members' then h.state end as state,
  case when p.show_address = 'members' then h.zip end as zip,
  h.photo_path as household_photo_path,
  h.anniversary
from people p
left join households h on h.id = p.household_id
where p.status = 'active' and is_active_member();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table households enable row level security;
alter table people enable row level security;
alter table announcements enable row level security;
alter table serving_signups enable row level security;
alter table events enable row level security;
alter table event_rsvps enable row level security;
alter table prayer_requests enable row level security;
alter table prayer_responses enable row level security;
alter table form_submissions enable row level security;
alter table newsletters enable row level security;

-- people: you see yourself; admins see everyone. Members browse via the view.
create policy people_self_read on people for select using (auth_user_id = auth.uid() or is_admin());
create policy people_self_update on people for update using (auth_user_id = auth.uid() or is_admin()) with check (auth_user_id = auth.uid() or is_admin());
create policy people_signup on people for insert with check (auth_user_id = auth.uid() and status = 'pending' and not is_admin);
create policy people_admin_insert on people for insert with check (is_admin());
create policy people_admin_delete on people for delete using (is_admin());

create policy households_read on households for select using (is_active_member());
create policy households_admin on households for all using (is_admin()) with check (is_admin());
create policy households_self_update on households for update
  using (id = (select household_id from people where auth_user_id = auth.uid()))
  with check (id = (select household_id from people where auth_user_id = auth.uid()));

create policy announcements_read on announcements for select
  using (is_admin() or (is_active_member() and (status = 'approved' or submitted_by = current_person_id())));
create policy announcements_suggest on announcements for insert
  with check (is_admin() or (is_active_member() and status = 'suggested' and submitted_by = current_person_id()));
create policy announcements_admin on announcements for all using (is_admin()) with check (is_admin());

create policy serving_read on serving_signups for select using (is_active_member());
create policy serving_self on serving_signups for insert with check (person_id = current_person_id());
create policy serving_self_delete on serving_signups for delete using (person_id = current_person_id() or is_admin());

create policy events_read on events for select
  using (is_admin() or (is_active_member() and (status = 'approved' or submitted_by = current_person_id())));
create policy events_suggest on events for insert
  with check (is_admin() or (is_active_member() and status = 'suggested' and submitted_by = current_person_id()));
create policy events_admin on events for all using (is_admin()) with check (is_admin());

create policy rsvps_read on event_rsvps for select using (is_active_member());
create policy rsvps_self on event_rsvps for all using (person_id = current_person_id() or is_admin()) with check (person_id = current_person_id() or is_admin());

create policy prayer_read on prayer_requests for select
  using (is_admin() or (is_active_member() and (audience = 'church' or person_id = current_person_id())));
create policy prayer_insert on prayer_requests for insert with check (is_active_member() and person_id = current_person_id());
create policy prayer_update on prayer_requests for update using (person_id = current_person_id() or is_admin()) with check (person_id = current_person_id() or is_admin());
create policy prayer_delete on prayer_requests for delete using (person_id = current_person_id() or is_admin());

create policy prayed_read on prayer_responses for select using (is_active_member());
create policy prayed_self on prayer_responses for all using (person_id = current_person_id()) with check (person_id = current_person_id());

create policy forms_insert on form_submissions for insert with check (is_active_member() and person_id = current_person_id());
create policy forms_read on form_submissions for select using (person_id = current_person_id() or is_admin());
create policy forms_admin on form_submissions for update using (is_admin()) with check (is_admin());

create policy newsletters_admin on newsletters for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Storage: member photos are private (served through signed URLs); announcement
-- and event images are public because they also go out in emails.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('member-photos', 'member-photos', false) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('public-media', 'public-media', true) on conflict do nothing;

create policy member_photos_read on storage.objects for select using (bucket_id = 'member-photos' and is_active_member());
create policy member_photos_write on storage.objects for insert with check (bucket_id = 'member-photos' and (is_admin() or (storage.foldername(name))[1] = current_person_id()::text));
create policy member_photos_update on storage.objects for update using (bucket_id = 'member-photos' and (is_admin() or (storage.foldername(name))[1] = current_person_id()::text));
create policy member_photos_delete on storage.objects for delete using (bucket_id = 'member-photos' and (is_admin() or (storage.foldername(name))[1] = current_person_id()::text));

create policy public_media_read on storage.objects for select using (bucket_id = 'public-media');
create policy public_media_write on storage.objects for insert with check (bucket_id = 'public-media' and is_active_member());
create policy public_media_admin on storage.objects for delete using (bucket_id = 'public-media' and is_admin());
