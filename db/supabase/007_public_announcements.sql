-- Approved announcements can be shown on the public church website, in the
-- "Happening at Beulah" carousel at the top of the home page. Like events,
-- each announcement has a switch so members-only news stays in the app.
-- Serving sign-ups never go public. The view runs as its owner so visitors
-- need no login, and only exposes what the carousel shows.

alter table announcements add column show_on_website boolean not null default true;

create view public_announcements as
select id, title, body, image_path, link_url, starts_on, ends_on, created_at
from announcements
where status = 'approved'
  and kind = 'announcement'
  and show_on_website
  and (starts_on is null or starts_on <= (now() at time zone 'America/Chicago')::date)
  and (ends_on is null or ends_on >= (now() at time zone 'America/Chicago')::date);

grant select on public_announcements to anon, authenticated;
