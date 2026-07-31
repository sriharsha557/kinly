import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countUnreadEvents } from './moments.ts';

const ME = 'user-me';
const FRIEND = 'user-friend';

test('counts a friend event newer than the stamp', () => {
  const events = [{ created_at: '2026-07-31T11:00:00Z', user_id: FRIEND }];
  assert.equal(countUnreadEvents(events, '2026-07-31T09:00:00Z', ME), 1);
});

test('ignores your own events', () => {
  const events = [{ created_at: '2026-07-31T11:00:00Z', user_id: ME }];
  assert.equal(countUnreadEvents(events, '2026-07-31T09:00:00Z', ME), 0);
});

test('ignores events older than the stamp', () => {
  const events = [{ created_at: '2026-07-31T08:00:00Z', user_id: FRIEND }];
  assert.equal(countUnreadEvents(events, '2026-07-31T09:00:00Z', ME), 0);
});

test('treats a null stamp as never read, so all friend events count', () => {
  const events = [
    { created_at: '2020-01-01T00:00:00Z', user_id: FRIEND },
    { created_at: '2026-07-31T11:00:00Z', user_id: FRIEND },
    { created_at: '2026-07-31T11:00:00Z', user_id: ME },
  ];
  assert.equal(countUnreadEvents(events, null, ME), 2);
});

test('an event exactly at the stamp is already read', () => {
  const events = [{ created_at: '2026-07-31T09:00:00Z', user_id: FRIEND }];
  assert.equal(countUnreadEvents(events, '2026-07-31T09:00:00Z', ME), 0);
});

test('returns 0 for an empty feed', () => {
  assert.equal(countUnreadEvents([], null, ME), 0);
});
