-- The guard trigger from 002 was security definer, which made current_user
-- always the owner, so the owner bypass matched every caller and the guard
-- never fired for API requests. It now runs as the caller. is_admin() is
-- still security definer and works from inside it.
-- Applied to beulah-baptist-app on 2026-11-03 and verified through the API.

create or replace function guard_people() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') or is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if new.is_admin or new.admin_notes is not null then raise exception 'Only the church office can set that.'; end if;
    return new;
  end if;
  if new.is_admin <> old.is_admin or new.status <> old.status
     or new.auth_user_id is distinct from old.auth_user_id
     or new.household_id is distinct from old.household_id
     or new.admin_notes is distinct from old.admin_notes then
    raise exception 'Only the church office can change that.';
  end if;
  return new;
end $$;
