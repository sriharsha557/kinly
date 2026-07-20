-- Optional context tags on a mood check-in ("What made today feel that
-- way?" - a second, optional layer shown after the required one-tap
-- mood). A plain text array, not a separate tags table: the tag set is
-- fixed/predefined per mood for now (no user-created custom tags yet -
-- that's a deliberately separate follow-up, since it needs its own
-- storage/vocabulary design), so there's nothing to join against.

alter table mood_checkins add column if not exists tags text[] not null default '{}';
