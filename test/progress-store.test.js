import test from 'node:test';
import assert from 'node:assert/strict';

import {
  adaptiveShuffle,
  addProfile,
  createProfileStore,
  deleteProfile,
  exportProfile,
  getActiveProfile,
  importProfile,
  loadProfileStore,
  profileSummary,
  recordActivity,
  recordGameSession,
  saveProfileStore,
} from '../web/js/progress-store.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test('profile store saves and reloads multiple profiles', () => {
  const storage = memoryStorage();
  const store = createProfileStore(new Date('2026-07-18T12:00:00Z'));
  const second = addProfile(store, 'Jordan', '📖');
  saveProfileStore(store, storage);
  const loaded = loadProfileStore(storage);
  assert.equal(loaded.profiles.length, 2);
  assert.equal(getActiveProfile(loaded).id, second.id);
  assert.equal(getActiveProfile(loaded).name, 'Jordan');
});

test('activity updates mastery, dimensions, and streaks', () => {
  const store = createProfileStore();
  const profile = getActiveProfile(store);
  recordActivity(
    profile,
    {
      contentType: 'questions',
      contentId: 'official-1-1',
      result: 'review',
      game: 'quiz-round',
      chapter: 1,
      questionType: 'G',
    },
    new Date(2026, 6, 18, 12),
  );
  recordActivity(
    profile,
    {
      contentType: 'questions',
      contentId: 'official-1-1',
      result: 'correct',
      game: 'quiz-round',
      chapter: 1,
      questionType: 'G',
      metadata: { buzzerWords: 5 },
    },
    new Date(2026, 6, 19, 12),
  );
  assert.equal(profile.stats.attempts, 2);
  assert.equal(profile.stats.correct, 1);
  assert.equal(profile.stats.streakDays, 2);
  assert.equal(profile.stats.byChapter['1'].attempts, 2);
  assert.equal(profile.stats.byQuestionType.G.attempts, 2);
  assert.equal(profile.content.questions['official-1-1'].buzzerWordsTotal, 5);
  assert.equal(profileSummary(profile).weakQuestions[0].id, 'official-1-1');
});

test('adaptive shuffle prioritizes unseen and weak content', () => {
  const store = createProfileStore();
  const profile = getActiveProfile(store);
  profile.content.questions.mastered = { mastery: 1, attempts: 5, correct: 5, review: 0 };
  const items = [{ id: 'mastered' }, { id: 'unseen' }];
  const ordered = adaptiveShuffle(items, 'questions', profile, () => 0.6);
  assert.equal(ordered[0].id, 'unseen');
});

test('sessions retain the best score', () => {
  const profile = getActiveProfile(createProfileStore());
  recordGameSession(profile, 'speed', 4);
  recordGameSession(profile, 'speed', 7);
  recordGameSession(profile, 'speed', 5);
  assert.equal(profile.stats.games.speed.bestScore, 7);
  assert.equal(profile.stats.games.speed.sessions, 3);
});

test('profiles export, import as a copy, and delete safely', () => {
  const store = createProfileStore();
  const original = getActiveProfile(store);
  const imported = importProfile(exportProfile(original), store);
  assert.notEqual(imported.id, original.id);
  assert.match(imported.name, /Imported/);
  deleteProfile(store, imported.id);
  assert.equal(store.profiles.length, 1);
  deleteProfile(store, original.id);
  assert.equal(store.profiles.length, 1);
});

test('invalid imports are rejected', () => {
  const store = createProfileStore();
  assert.throws(() => importProfile('{"not":"a profile"}', store), /not a Bible Quiz profile/);
});
