-- Align built-in room codes with the abbreviations the team uses
-- (OpenProject #106):
--   FZ  -> FR   (Freezer)
--   3DC -> 3D   (3Door Cooler)
--   (new) OT    Unassigned
-- Renaming a locations.code requires refreshing every dependent sub_locations.code
-- because the trigger only fires on changes to the sub_location row itself.

update locations set code = 'FR'              where code = 'FZ';
update locations set code = '3D', name = '3Door Cooler' where code = '3DC';

-- Recompute sub_locations.code for any rows whose room code changed by touching
-- one of the trigger columns. Bumping location_id to itself is a no-op
-- update that still fires sub_locations_set_code_trg.
update sub_locations sl
   set location_id = sl.location_id
  from locations l
 where sl.location_id = l.id
   and l.code in ('FR', '3D');

insert into locations (code, name, sort_order, is_active)
values ('OT', 'Unassigned', 70, true)
on conflict (code) do nothing;
