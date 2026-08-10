import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_RESULTS,
  listUniqueWords,
  searchScripture,
} from '../web/js/scripture-concordance.js';

const chapters = [
  {
    chapter: 1,
    verses: [
      { verse: 1, text: 'In the beginning was the Word, and the Word was with God.', reference: 'John 1:1' },
      { verse: 4, text: 'In him was life, and that life was the light of all mankind.', reference: 'John 1:4' },
      { verse: 5, text: 'The light shines in the darkness.', reference: 'John 1:5' },
    ],
  },
  {
    chapter: 3,
    verses: [
      { verse: 16, text: 'For God so loved the world that he gave his one and only Son.', reference: 'John 3:16' },
    ],
  },
];

const uniqueWords = [
  { word: 'fullness', reference: 'John 1:16', chapter: 1 },
  { word: 'Bethesda', reference: 'John 5:2', chapter: 5 },
  { word: 'light', reference: 'John 1:4', chapter: 1 },
];

test('searchScripture finds a single word', () => {
  const results = searchScripture(chapters, 'light');
  assert.ok(results.length >= 2);
  assert.ok(results.every((row) => /light/i.test(row.snippet) || row.verse === 4 || row.verse === 5));
});

test('searchScripture finds a phrase', () => {
  const results = searchScripture(chapters, 'one and only');
  assert.equal(results.length, 1);
  assert.equal(results[0].reference, 'John 3:16');
});

test('searchScripture respects chapter filter', () => {
  const results = searchScripture(chapters, 'God', { chapterFilter: 3 });
  assert.equal(results.length, 1);
  assert.equal(results[0].chapter, 3);
});

test('searchScripture empty query returns no results', () => {
  assert.deepEqual(searchScripture(chapters, '   '), []);
  assert.deepEqual(searchScripture(chapters, ''), []);
});

test('searchScripture caps results at MAX_RESULTS', () => {
  const many = [
    {
      chapter: 1,
      verses: Array.from({ length: 80 }, (_, index) => ({
        verse: index + 1,
        text: `Verse about Jesus number ${index + 1}`,
        reference: `John 1:${index + 1}`,
      })),
    },
  ];
  const results = searchScripture(many, 'Jesus');
  assert.equal(results.length, MAX_RESULTS);
});

test('listUniqueWords filters by chapter and query', () => {
  assert.equal(listUniqueWords(uniqueWords, { chapterFilter: 1 }).length, 2);
  assert.equal(listUniqueWords(uniqueWords, { chapterFilter: 1, query: 'ful' }).length, 1);
  assert.equal(listUniqueWords(uniqueWords, { query: 'bethesda' })[0].word, 'Bethesda');
});
