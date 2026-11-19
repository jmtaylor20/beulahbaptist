-- iPhone push notifications. The Beulah Members iOS app hands its Apple push
-- token to the site (cookie "beulah_push_token"); the member layout saves it
-- here for the signed-in person. Server code (lib/push.ts) reads and writes
-- this table with the service-role client only, so RLS is on with no
-- policies: members can never read other people's device tokens.
-- Applied to beulah-baptist-app on 2026-11-19.

create table push_devices (
  token       text primary key,
  person_id   uuid not null references people(id) on delete cascade,
  platform    text not null default 'ios',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index push_devices_person_idx on push_devices (person_id);

alter table push_devices enable row level security;
