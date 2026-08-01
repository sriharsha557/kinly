import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countUnreadEvents, isUnreadFor } from './moments.ts';

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

// A buddy_checkin row is about its user_id rather than by them, so the actor
// arrives separately. Without actor_id these two cases invert: reaching out
// to someone would mark the sender's own feed unread and leave the
// recipient's untouched - the opposite of what either person wants.
test('reaching out to someone does not mark your own feed unread', () => {
  const events = [{ created_at: '2026-07-31T11:00:00Z', user_id: FRIEND, actor_id: ME }];
  assert.equal(countUnreadEvents(events, '2026-07-31T09:00:00Z', ME), 0);
});

test('being reached out to does mark your feed unread', () => {
  const events = [{ created_at: '2026-07-31T11:00:00Z', user_id: ME, actor_id: FRIEND }];
  assert.equal(countUnreadEvents(events, '2026-07-31T09:00:00Z', ME), 1);
});

test('a null actor_id falls back to user_id, preserving the old rule', () => {
  const mine = [{ created_at: '2026-07-31T11:00:00Z', user_id: ME, actor_id: null }];
  assert.equal(countUnreadEvents(mine, '2026-07-31T09:00:00Z', ME), 0);
  const theirs = [{ created_at: '2026-07-31T11:00:00Z', user_id: FRIEND, actor_id: null }];
  assert.equal(countUnreadEvents(theirs, '2026-07-31T09:00:00Z', ME), 1);
});

test('isUnreadFor agrees with countUnreadEvents on the same row', () => {
  const event = { created_at: '2026-07-31T11:00:00Z', user_id: ME, actor_id: FRIEND };
  assert.equal(isUnreadFor(event, '2026-07-31T09:00:00Z', ME), true);
  assert.equal(countUnreadEvents([event], '2026-07-31T09:00:00Z', ME), 1);
});
