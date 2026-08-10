import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cellsOnLine,
  createBlankQuestion,
  createJeopardyBoard,
  createVerseScramble,
  createWordSearch,
  countWordInGrid,
  normalizeAnswer,
  shuffle,
  wordSearchGridSize,
  WORD_SEARCH_DIFFICULTY,
  WORD_SEARCH_LETTER_CELL_RATIO,
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

test('blank ratio 0 hides no words', () => {
  const question = createBlankQuestion(verses[0], 0, () => 0.5);
  assert.equal(question.answers.size, 0);
  assert.equal(question.blankRatio, 0);
});

test('blank ratio 1 percent hides at least one eligible word', () => {
  const question = createBlankQuestion(verses[0], 0.01, () => 0.5);
  assert.ok(question.answers.size >= 1);
  for (const index of question.answers.keys()) {
    assert.ok(normalizeAnswer(question.words[index]).length >= 4);
  }
});

test('blank ratio 22 percent matches expected eligible count', () => {
  const eligibleCount = verses[0].text
    .split(' ')
    .filter((word) => normalizeAnswer(word).length >= 4).length;
  const expected = Math.max(1, Math.round(eligibleCount * 0.22));
  const question = createBlankQuestion(verses[0], 0.22, () => 0.5);
  assert.equal(question.answers.size, expected);
  assert.equal(question.blankRatio, 0.22);
});

test('blank ratio 100 percent blanks every word', () => {
  const question = createBlankQuestion(verses[0], 1, () => 0.5);
  assert.equal(question.answers.size, question.words.length);
  assert.equal(question.blankRatio, 1);
});

test('blank ratio clamps outside 0..1', () => {
  assert.equal(createBlankQuestion(verses[0], -2, () => 0.5).blankRatio, 0);
  assert.equal(createBlankQuestion(verses[0], 4, () => 0.5).blankRatio, 1);
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
    ['According To', 'General', 'Quote', 'Situation', 'Context'],
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

test('wordSearchGridSize uses letter-cell budget within difficulty bands', () => {
  assert.equal(WORD_SEARCH_LETTER_CELL_RATIO, 2.1);
  const size = wordSearchGridSize([8, 8, 7, 7, 6, 6, 5], WORD_SEARCH_DIFFICULTY.medium);
  assert.ok(size >= WORD_SEARCH_DIFFICULTY.medium.minSize);
  assert.ok(size <= WORD_SEARCH_DIFFICULTY.medium.maxSize);
});

test('word search places every requested word exactly once without collinear shares', () => {
  const pool = [
    { word: 'LIGHT' },
    { word: 'WORLD' },
    { word: 'TRUTH' },
    { word: 'GRACE' },
    { word: 'PEACE' },
    { word: 'FAITH' },
    { word: 'WATER' },
    { word: 'BREAD' },
    { word: 'STONE' },
    { word: 'VOICE' },
    { word: 'HEART' },
    { word: 'GLORY' },
    { word: 'POWER' },
  ];
  let value = 0.17;
  const random = () => {
    value = (value * 1.6180339887) % 1;
    return value;
  };
  const puzzle = createWordSearch(pool, { difficulty: 'medium' }, random);
  assert.equal(puzzle.placements.length, WORD_SEARCH_DIFFICULTY.medium.count);
  assert.ok(puzzle.grid.every((row) => row.every(Boolean)));
  for (const { word } of puzzle.placements) {
    assert.equal(countWordInGrid(puzzle.grid, word), 1, word);
  }
  assert.equal(puzzle.stats.collinearShares, 0);
  assert.ok(
    puzzle.quality === true || puzzle.stats.diagonalRatio >= 0.2,
    'prefer full quality; soft-pass still keeps a usable diagonal mix',
  );
});

test('word search options form derives size from difficulty bands', () => {
  const pool = [
    { word: 'FULLNESS' },
    { word: 'BETHESDA' },
    { word: 'WITNESS' },
    { word: 'DISCIPLE' },
    { word: 'PROPHET' },
    { word: 'TEMPLE' },
    { word: 'SPIRIT' },
    { word: 'KINGDOM' },
    { word: 'SERVANT' },
    { word: 'MESSIAH' },
  ];
  let value = 0.31;
  const random = () => {
    value = (value * 1.4142135623) % 1;
    return value;
  };
  const puzzle = createWordSearch(pool, { difficulty: 'easy' }, random);
  assert.ok(puzzle.size >= WORD_SEARCH_DIFFICULTY.easy.minSize);
  assert.ok(puzzle.size <= WORD_SEARCH_DIFFICULTY.easy.maxSize);
  assert.equal(puzzle.placements.length, WORD_SEARCH_DIFFICULTY.easy.count);
});
