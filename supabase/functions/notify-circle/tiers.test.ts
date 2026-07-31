import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tierFor } from './tiers.ts';

test('nudges always push - they name one person', () => {
  assert.equal(tierFor('nudges', undefined, {}), 'immediate');
});

test('ask replies always push - the author is waiting', () => {
  assert.equal(tierFor('ask_replies', undefined, {}), 'immediate');
});

test('membership rows always push', () => {
  assert.equal(tierFor('circle_members', undefined, {}), 'immediate');
});

test('an ask pushes to the circle', () => {
  assert.equal(tierFor('events', 'ask', {}), 'immediate');
});

test('a streak-at-risk reminder pushes', () => {
  assert.equal(tierFor('events', 'reminder', {}), 'immediate');
});

test('a tough-day check-in pushes', () => {
  assert.equal(tierFor('events', 'mood_checkin', { mood: 'tough' }), 'immediate');
});

test('an okay or great check-in does not push', () => {
  assert.equal(tierFor('events', 'mood_checkin', { mood: 'okay' }), 'feed');
  assert.equal(tierFor('events', 'mood_checkin', { mood: 'great' }), 'feed');
});

test('a check-in with no mood in the payload does not push', () => {
  assert.equal(tierFor('events', 'mood_checkin', {}), 'feed');
});

test('celebrations are feed-only', () => {
  assert.equal(tierFor('events', 'goal_completed', {}), 'feed');
  assert.equal(tierFor('events', 'streak', {}), 'feed');
  assert.equal(tierFor('events', 'challenge_completed', {}), 'feed');
  assert.equal(tierFor('events', 'streak_saved', {}), 'feed');
  assert.equal(tierFor('events', 'progress_photo', {}), 'feed');
});

test('the four new types are feed-only', () => {
  assert.equal(tierFor('events', 'goal_started', {}), 'feed');
  assert.equal(tierFor('events', 'achievement_unlocked', {}), 'feed');
  assert.equal(tierFor('events', 'garden_grew', {}), 'feed');
  assert.equal(tierFor('events', 'buddy_checkin', {}), 'feed');
});

test('an unknown event type is feed-only, never a surprise push', () => {
  assert.equal(tierFor('events', 'something_new', {}), 'feed');
  assert.equal(tierFor('events', undefined, {}), 'feed');
});
