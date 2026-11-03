-- A pending login cannot read households yet, so inserting one and returning
-- its id fails under RLS. This function does it on the login's behalf.
-- Applied to beulah-baptist-app on 2026-11-03.

create or replace function signup_household(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select household_id into hid from people where auth_user_id = auth.uid();
  if hid is not null then return hid; end if;
  insert into households (name) values (coalesce(nullif(trim(p_name), ''), 'New family')) returning id into hid;
  return hid;
end $$;

drop policy if exists households_signup on households;
