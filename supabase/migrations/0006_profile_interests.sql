-- Lets onboarding capture personal interests (health/wealth/ideas/learning/
-- relationships) so the Feed can suggest relevant goals. Nullable and
-- defaulting to NULL (not '{}') so the client can tell "never asked" apart
-- from "asked, and the user picked none" (Skip for now).
alter table profiles add column interests text[];
