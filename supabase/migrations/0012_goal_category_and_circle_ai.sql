-- Circle AI needs to know which pillar (health/wealth/ideas/learning/
-- relationships) each goal belongs to, to say things like "strongest at
-- saving money, everyone skipped reading this week." Nullable: goals
-- created before this migration, or without a category picked, just
-- don't count toward the per-pillar breakdown.
alter table goals add column category text;
