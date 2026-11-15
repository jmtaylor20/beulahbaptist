-- First visit after approval goes to the family page. The stamp is set the
-- first time the login saves that page; until then the home page sends them
-- there. Existing admins are stamped so they are not prompted.
-- Applied to beulah-baptist-app on 2026-11-15.

alter table people add column profile_completed_at timestamptz;
update people set profile_completed_at = now() where is_admin;
