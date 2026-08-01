-- New Moments vocabulary (docs/superpowers/specs/2026-07-31-notifications-
-- design.md). Follows 0015/0023/0025/0026's pattern of extending the enum
-- in place rather than replacing it. All four are feed-only tiers - none of
-- them pushes - so this migration is safe to apply before the matching
-- notify-circle deploy.
--
-- achievement_unlocked has no emitter yet, deliberately: every
-- useCreateAchievement call site in the app already emits goal_completed,
-- streak or challenge_completed for the same moment, so emitting this one
-- too would duplicate every celebration in the feed. The value exists so a
-- future unpaired achievement has somewhere to land.
alter type event_type add value if not exists 'goal_started';
alter type event_type add value if not exists 'achievement_unlocked';
alter type event_type add value if not exists 'garden_grew';
alter type event_type add value if not exists 'buddy_checkin';
