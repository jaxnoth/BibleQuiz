import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceRevealCount,
  prefersReducedMotion,
  revealedVerseText,
  tokenizeVerse,
} from '../web/js/flash-reveal.js';

const words = tokenizeVerse('In the beginning was the Word');

test('tokenizeVerse splits on whitespace', () => {
  assert.deepEqual(words, ['In', 'the', 'beginning', 'was', 'the', 'Word']);
});

test('tap advance reveals one more word', () => {
  assert.equal(advanceRevealCount(0, words.length), 1);
  assert.equal(revealedVerseText(words, 1), 'In ...');
  assert.equal(advanceRevealCount(1, words.length), 2);
});

test('reveal all completes the verse', () => {
  assert.equal(revealedVerseText(words, words.length), words.join(' '));
  assert.equal(advanceRevealCount(words.length, words.length), words.length);
});

test('autoplay style advancement reaches completion', () => {
  let count = 0;
  while (count < words.length) {
    count = advanceRevealCount(count, words.length);
  }
  assert.equal(count, words.length);
  assert.equal(revealedVerseText(words, count), 'In the beginning was the Word');
});

test('pause is represented by stopping further advances', () => {
  const pausedAt = 2;
  assert.equal(revealedVerseText(words, pausedAt), 'In the ...');
  assert.equal(pausedAt, 2);
});

test('prefersReducedMotion reads matchMedia when present', () => {
  assert.equal(
    prefersReducedMotion({
      matchMedia: () => ({ matches: true }),
    }),
    true,
  );
  assert.equal(
    prefersReducedMotion({
      matchMedia: () => ({ matches: false }),
    }),
    false,
  );
});
