import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cellsOnLine,
  createBlankQuestion,
  createJeopardyBoard,
  createVerseScramble,
  createWordSearch,
  normalizeAnswer,
  shuffle,
} from '../web/js/game-engine.js';

const verses = [
  {
    reference: 'John 3:16',
    chapter: 3,
    jumpWords: 'For God so',
    text: 'For God so loved the world that he gave his one and only Son.',
  },
  {
    reference: 'John 1:1',
    chapter: 1,
    jumpWords: 'In',
    text: 'In the beginning was the Word.',
  },
];

const uniqueWords = [
  { word: 'fullness', reference: 'John 1:16', chapter: 1 },
  { word: 'Bethesda', reference: 'John 5:2', chapter: 5 },
];

const quizQuestions = ['A', 'G', 'Q', 'S', 'X'].map((typeCode, index) => ({
  id: `official-1-${index + 1}`,
  question: `Official question ${typeCode}`,
  answer: `Answer ${typeCode}`,
  reference: `John 1:${index + 1}`,
  typeCode,
}));

test('normalizeAnswer ignores capitalization and punctuation', () => {
  assert.equal(normalizeAnswer('  God’s WRATH! '), 'gods wrath');
});

test('shuffle does not mutate its input', () => {
  const input = [1, 2, 3, 4];
  const result = shuffle(input, () => 0);
  assert.deepEqual(input, [1, 2, 3, 4]);
  assert.notDeepEqual(result, input);
});

test('blank questions hide at least one eligible word', () => {
  const question = createBlankQuestion(verses[0], 'easy', () => 0.5);
  assert.ok(question.answers.size >= 1);
  assert.equal(question.difficulty, 'easy');
});

test('cellsOnLine accepts horizontal, vertical, and diagonal lines', () => {
  assert.equal(cellsOnLine({ x: 0, y: 0 }, { x: 3, y: 0 }).length, 4);
  assert.equal(cellsOnLine({ x: 2, y: 1 }, { x: 2, y: 4 }).length, 4);
  assert.equal(cellsOnLine({ x: 0, y: 0 }, { x: 3, y: 3 }).length, 4);
  assert.deepEqual(cellsOnLine({ x: 0, y: 0 }, { x: 3, y: 2 }), []);
});

test('Jeopardy can use official questions or study drills', () => {
  const official = createJeopardyBoard(verses, uniqueWords, quizQuestions, 'official', () => 0);
  const drills = createJeopardyBoard(verses, uniqueWords, quizQuestions, 'drills', () => 0);
  assert.deepEqual(
    official.map(({ name }) => name),
    ['According To', 'General', 'Quote', 'Situation', 'Reference'],
  );
  assert.deepEqual(
    drills.map(({ name }) => name),
    ['References', 'Finish the Verse', 'Missing Words', 'Jump Words', 'Unique Words'],
  );
  assert.equal(official[0].clues[0].clue, 'Official question A');
});

test('verse scramble preserves every phrase and changes their order', () => {
  const scramble = createVerseScramble(verses[0], () => 0);
  assert.equal(
    scramble.chunks.map(({ text }) => text).join(' '),
    verses[0].text,
  );
  assert.notDeepEqual(
    scramble.shuffled.map(({ id }) => id),
    scramble.chunks.map(({ id }) => id),
  );
});

test('word search creates a filled square grid', () => {
  let value = 0;
  const random = () => {
    value = (value + 0.173) % 1;
    return value;
  };
  const puzzle = createWordSearch(uniqueWords, 10, 2, random);
  assert.equal(puzzle.grid.length, 10);
  assert.ok(puzzle.grid.every((row) => row.length === 10 && row.every(Boolean)));
  assert.ok(puzzle.placements.length > 0);
});
