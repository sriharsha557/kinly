-- The library itself. Separate from 0044 because 'support' cannot be used in
-- the same transaction that adds it to the nudge_kind enum.
--
-- Weighting: 3 = safe in almost any situation, 2 = usually fine, 1 = good but
-- situational. Volume is deliberately ~70 rather than the 150 first proposed:
-- writing that much before the voice is proven is the expensive mistake, and
-- adding more later is one insert.
--
-- Voice notes. support: no exclamation-heavy cheerfulness at someone having a
-- bad day, no advice, and no "you've got this" - that reads as pressure here
-- and belongs in keep_going. About a third of lines carry {name}, so the pool
-- mixes addressed and unaddressed.
--
-- Safe to re-run: deletes the seeded set first. Hand-added rows are NOT
-- protected by this - if you add your own copy, add it in a later migration.
delete from nudge_messages;

insert into nudge_messages (kind, body, placeholders, weight) values
  -- support (15): a tough-day check-in.
  ('support', 'Thinking of you today.', '{}', 3),
  ('support', 'No pressure today. I''m here.', '{}', 3),
  ('support', 'Rough days happen. Glad you said something.', '{}', 2),
  ('support', 'Hey {name} — here if you want to talk.', '{name}', 3),
  ('support', 'You don''t have to do anything today.', '{}', 2),
  ('support', 'Sending you something good, {name}.', '{name}', 2),
  ('support', 'Tomorrow gets to be different.', '{}', 2),
  ('support', 'That sounds hard. I''m around.', '{}', 2),
  ('support', 'Be kind to yourself today.', '{}', 3),
  ('support', 'You showed up and said it. That counts.', '{}', 1),
  ('support', 'Take the day off if you need it, {name}.', '{name}', 1),
  ('support', 'Still in your corner.', '{}', 3),
  ('support', 'Nothing to fix. Just checking in.', '{}', 2),
  ('support', 'Hope tonight''s a bit lighter.', '{}', 1),
  ('support', 'Whatever today was, it''s allowed.', '{}', 1),

  -- cheer (15): celebrating something they did.
  ('cheer', 'Proud of you!', '{}', 3),
  ('cheer', 'Nice one, {name}!', '{name}', 3),
  ('cheer', 'That''s the good stuff.', '{}', 2),
  ('cheer', 'Look at you go.', '{}', 3),
  ('cheer', 'Well done, {name}.', '{name}', 3),
  ('cheer', 'You made that look easy.', '{}', 2),
  ('cheer', 'Big fan of this.', '{}', 2),
  ('cheer', 'Quietly impressed over here.', '{}', 1),
  ('cheer', 'That''s a proper effort.', '{}', 2),
  ('cheer', 'Yes! Keep it rolling.', '{}', 2),
  ('cheer', '{streak} days strong — nice going.', '{streak}', 2),
  ('cheer', '{name}, that''s {streak} days now. Solid.', '{name,streak}', 2),
  ('cheer', 'Good on you for {goal}.', '{goal}', 2),
  ('cheer', 'Noticed you sticking with this.', '{}', 1),
  ('cheer', 'This is becoming a habit, and I''m here for it.', '{}', 1),

  -- keep_going (15): encouragement toward a goal.
  ('keep_going', 'You''ve got this.', '{}', 3),
  ('keep_going', 'Still cheering for you, {name}.', '{name}', 3),
  ('keep_going', 'One small step today still counts.', '{}', 1),
  ('keep_going', 'No rush. Just don''t stop.', '{}', 2),
  ('keep_going', 'Keep going on {goal}!', '{goal}', 3),
  ('keep_going', '{name}, today''s a good day for {goal}.', '{name,goal}', 2),
  ('keep_going', 'Even a little counts today.', '{}', 2),
  ('keep_going', 'You''re closer than you think.', '{}', 2),
  ('keep_going', 'Back at it when you''re ready.', '{}', 2),
  ('keep_going', 'Rooting for you, {name}.', '{name}', 3),
  ('keep_going', 'Momentum beats perfect.', '{}', 1),
  ('keep_going', 'Pick it back up whenever.', '{}', 1),
  ('keep_going', 'Nothing wasted — start again today.', '{}', 1),
  ('keep_going', 'Your future self says thanks.', '{}', 1),
  ('keep_going', 'Small and steady wins this.', '{}', 2),

  -- water (6)
  ('water', 'Go drink some water!', '{}', 3),
  ('water', 'Hydrate, {name}.', '{name}', 3),
  ('water', 'Water break?', '{}', 2),
  ('water', 'Your water bottle misses you.', '{}', 1),
  ('water', 'Quick glass of water — go on.', '{}', 2),
  ('water', 'Sip something, {name}.', '{name}', 1),

  -- walk (6)
  ('walk', 'Go stretch your legs!', '{}', 3),
  ('walk', 'Time for a walk, {name}?', '{name}', 3),
  ('walk', 'Five minutes outside would help.', '{}', 2),
  ('walk', 'Shoes on. Just around the block.', '{}', 2),
  ('walk', 'Fresh air is calling.', '{}', 1),
  ('walk', 'Quick wander, {name}?', '{name}', 1),

  -- workout (6)
  ('workout', 'Let''s get that workout in!', '{}', 3),
  ('workout', 'Gym time, {name}.', '{name}', 3),
  ('workout', 'Twenty minutes is still a workout.', '{}', 2),
  ('workout', 'Move a bit today?', '{}', 2),
  ('workout', 'Future you will be glad.', '{}', 1),
  ('workout', 'Go on {name}, get it done.', '{name}', 1),

  -- streak (6)
  ('streak', 'Don''t break the streak now!', '{}', 3),
  ('streak', '{streak} days. Keep it alive!', '{streak}', 3),
  ('streak', '{name}, that streak is worth saving.', '{name}', 3),
  ('streak', 'One log keeps it going.', '{}', 2),
  ('streak', 'Too good a run to drop, {name}.', '{name}', 2),
  ('streak', '{streak} days of work — protect it.', '{streak}', 1);
