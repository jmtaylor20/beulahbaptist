-- One login per family. The person who signs up becomes the household's
-- head; from their profile they add a spouse and children (rows in people
-- with no auth_user_id). Applied to beulah-baptist-app on 2026-11-03.

create or replace function my_household_id() returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from people where auth_user_id = auth.uid()
$$;

-- A new family creates its household at signup, before it is approved.
create policy households_signup on households for insert with check (auth.uid() is not null);

-- An active login manages the people in its own household who have no login
-- of their own. Privilege and status fields are guarded by the trigger below.
create policy people_family_insert on people for insert
  with check (is_active_member() and household_id is not null and household_id = my_household_id() and auth_user_id is null and not is_admin and status = 'active');
create policy people_family_update on people for update
  using (is_active_member() and auth_user_id is null and household_id = my_household_id())
  with check (is_active_member() and auth_user_id is null and household_id = my_household_id());
create policy people_family_delete on people for delete
  using (is_active_member() and auth_user_id is null and household_id = my_household_id());

-- Only the church office (or the database owner) may change who is an admin,
-- a person's status, which login or household they belong to, or office notes.
create or replace function guard_people() returns trigger
language plpgsql security definer set search_path = public as $$
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
create trigger people_guard before insert or update on people for each row execute function guard_people();
