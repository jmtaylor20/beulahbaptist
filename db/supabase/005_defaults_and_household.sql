-- Members see email, address and birthday (month and day) by default; phone
-- stays office-only unless the member opens it. Existing rows that were
-- still on the old defaults are moved to the new ones.
-- Applied to beulah-baptist-app on 2026-11-04.

alter table people alter column show_email set default 'members';
alter table people alter column show_address set default 'members';
alter table people alter column show_birthday set default 'members';

update people set show_email = 'members', show_address = 'members', show_birthday = 'members'
where show_email = 'church' and show_address = 'church' and show_birthday = 'church' and show_phone = 'church';

-- signup_household now also attaches the household to the caller's people
-- row, so an approved member who somehow has none gets one on first visit.
create or replace function signup_household(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select household_id into hid from people where auth_user_id = auth.uid();
  if hid is not null then return hid; end if;
  insert into households (name) values (coalesce(nullif(trim(p_name), ''), 'New family')) returning id into hid;
  update people set household_id = hid, role = 'head' where auth_user_id = auth.uid() and household_id is null;
  return hid;
end $$;
