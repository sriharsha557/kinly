# Kinly — Roadmap

Ideas that came up during a session but were deliberately deferred rather than folded into whatever prompted them, so they don't get lost. Not a commitment or a priority order — a holding pen. Move an item here into ARCHITECTURE.md once it's actually built.

## Profile stat tiles

The v1 six-tile grid (Goals done, Active goals, Current streak, Completion rate, Circle members, Settings) shipped using only data that already existed. These didn't make the cut because each needs real new tracking or a new screen, not just a UI change:

- **Best streak (lifetime max)** — the schema only tracks each goal's *current* `streak_count`; there's no "highest it ever reached" column. Needs a new column (e.g. `goals.best_streak_count`) updated whenever the running streak beats it, or a small history table if we ever want to know *when* a personal best happened.
- **Circle streak** — "how many consecutive days has the circle collectively been active" doesn't exist as a concept anywhere yet. Garden health is a %, not a day-count streak. Needs its own definition (what counts as "the circle was active" on a given day?) before it can be tracked, let alone displayed.
- **Dedicated detail screens** — several proposed tap destinations don't exist: a personal streak calendar, a circle-streak page, a monthly analytics dashboard, a missed-check-in calendar. All six v1 tiles route to the closest *existing* screen (mostly Goals/Circle tabs) instead of these, so the tap targets are honest today rather than promising screens that aren't built.

## Mood check-in

- **User-created custom tags** — the "+ Add Tag" flow (type your own tag, app remembers it for next time). The shipped version only has fixed, predefined tags per mood. Needs its own storage/vocabulary design (per-user? per-circle? shared across the app?), not just a UI affordance.
- **Trend surfacing off tag data** — e.g. "you logged Lots of work 8 times this month." Needs aggregation logic once there's actually a season of tag data to aggregate.

## Other

- **AI-generated "boosting" messages per mood check-in status** — varying encouragement copy instead of the same message every time. Recommendation when this came up: a rotating pool of static variants per mood, not a live AI call on every check-in (latency/cost on the app's fastest interaction).
- **`kinly-logo-animated.svg`/`kinly-logo.json` (Lottie)** — committed to the repo as "standby" assets, never wired in. Needs `lottie-react-native`, a new native dependency requiring a fresh `eas build`.
