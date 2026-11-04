-- Approved events can be shown on the public church website. Each event has
-- a switch (on by default) so things like a youth night at a member's home
-- can stay inside the members app. The view exposes only what the public
-- page needs and runs as its owner so visitors need no login.
-- Applied to beulah-baptist-app on 2026-11-04.

alter table events add column show_on_website boolean not null default true;

create view public_events as
select id, title, description, location, starts_at, ends_at, all_day, image_path
from events
where status = 'approved' and show_on_website and starts_at >= now() - interval '1 day';

grant select on public_events to anon, authenticated;
