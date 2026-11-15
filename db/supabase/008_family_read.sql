-- A family login could insert spouse and children but not read them back:
-- people_self_read only covers your own row (or everything for admins), so
-- the insert's RETURNING failed with "new row violates row-level security"
-- and the family page could not list them. Members may now read the rows in
-- their own household that have no login of their own.
-- Applied to beulah-baptist-app on 2026-11-15.

create policy people_family_read on people for select
  using (is_active_member() and auth_user_id is null and household_id = my_household_id());
