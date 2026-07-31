-- User-selectable theming (accent + appearance mode), synced across
-- devices via the profile row. Nullable defaulting to NULL - same "never
-- asked" marker pattern as 0006's interests - so onboarding can tell
-- "never chose" (show the theme step) apart from "chose the defaults".
-- The client falls back to 'ember' (the original orange) + 'system' when
-- NULL, so existing users see no change.
--
-- No new RLS needed: 0001's "users manage their own profile" policy
-- already restricts updates to the owner's row, and these columns ride
-- along with it.

alter table profiles add column theme_accent text
  check (theme_accent in ('ember', 'garden', 'dusk'));

alter table profiles add column theme_mode text
  check (theme_mode in ('light', 'dark', 'system'));
