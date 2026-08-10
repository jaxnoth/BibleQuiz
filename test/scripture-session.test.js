import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalScriptureProvider } from '../web/js/scripture-provider.js';
import { createScriptureSession } from '../web/js/scripture-session.js';

const studyData = {
  metadata: {
    translation: 'NIV',
    abbreviation: 'NIV',
    source: 'bundled-study-data',
    distribution: 'internal-team',
    scriptureAttribution: 'Internal personal practice only.',
    ipHolder: 'Biblica',
    ipHolderUrl: 'https://www.biblica.com',
  },
  scriptureChapters: [
    {
      book: 'John',
      chapter: 1,
      verses: [
        { verse: 1, text: 'In the beginning was the Word.', reference: 'John 1:1' },
        { verse: 5, text: 'The light shines in the darkness.', reference: 'John 1:5' },
      ],
    },
  ],
  memoryVerses: [
    {
      reference: 'John 1:1',
      book: 'John',
      chapter: 1,
      verseStart: 1,
      verseEnd: 1,
      text: 'In the beginning was the Word.',
    },
  ],
  uniqueWords: [
    { word: 'shines', reference: 'John 1:5', book: 'John', chapter: 1, verseStart: 5, verseEnd: 5 },
    { word: 'Bethesda', reference: 'John 5:2', book: 'John', chapter: 5, verseStart: 2, verseEnd: 2 },
  ],
};

const session = createScriptureSession(createLocalScriptureProvider(studyData), studyData);

test('getChapterView joins provider text with memory and unique overlays', async () => {
  const view = await session.getChapterView('John', 1);
  assert.equal(view.book, 'John');
  assert.equal(view.chapter, 1);
  assert.equal(view.verses.length, 2);
  assert.equal(view.memoryVerses.length, 1);
  assert.equal(view.uniqueWords.length, 1);
  assert.equal(view.uniqueWords[0].word, 'shines');
  assert.equal(view.metadata.translation, 'NIV');
  assert.equal(view.capabilities.offline, true);
  assert.equal(view.limits.maxVisibleChapters, null);
});

test('getChapterView includes metadata capabilities limits', async () => {
  const view = await session.getChapterView('John', 1);
  assert.equal(view.metadata.provider, 'local');
  assert.equal(view.capabilities.apiBible, false);
  assert.equal(view.limits.requiresSecureKeyHandling, false);
});

test('missing chapter is handled safely', async () => {
  const view = await session.getChapterView('John', 99);
  assert.equal(view.verses.length, 0);
  assert.equal(view.memoryVerses.length, 0);
  assert.equal(view.uniqueWords.length, 0);
  assert.equal(view.metadata.provider, 'local');
  assert.ok(view.capabilities);
  assert.ok(view.limits);
});

test('session search pass-through includes book', async () => {
  const results = await session.search('light', { book: 'John', chapter: 1 });
  assert.equal(results.length, 1);
  assert.equal(results[0].book, 'John');
  assert.equal(results[0].verse, 5);
});

test('session listUniqueWords filters study overlays', async () => {
  const words = await session.listUniqueWords({ chapter: 1, query: 'shi' });
  assert.equal(words.length, 1);
  assert.equal(words[0].word, 'shines');
});

test('local validateVisibleContent allows unlimited content', async () => {
  const result = await session.validateVisibleContent({
    chapters: [1, 2, 3],
    verses: Array.from({ length: 100 }, (_, i) => i + 1),
  });
  assert.equal(result.ok, true);
  assert.equal(await session.canRender({ chapters: [1, 2, 3] }), true);
});

test('session reports fumsToken via injectable reporter', async () => {
  const tokens = [];
  const provider = {
    async getMetadata() {
      return {
        provider: 'api.bible',
        capabilities: { fumRequired: true },
        limits: { maxVisibleChapters: 2, maxVisibleVerses: 25 },
      };
    },
    async listChapters() {
      return [1];
    },
    async getChapter() {
      return {
        book: 'John',
        chapter: 1,
        verses: [{ verse: 1, text: 'In the beginning was the Word.', reference: 'John 1:1' }],
        metadata: {
          provider: 'api.bible',
          capabilities: { fumRequired: true },
          limits: { maxVisibleChapters: 2, maxVisibleVerses: 25 },
        },
        fumsToken: 'view-token',
      };
    },
    async search() {
      return { results: [], fumsToken: 'search-token' };
    },
  };
  const apiSession = createScriptureSession(provider, studyData, {
    fumsReporter: (token) => tokens.push(token),
  });
  await apiSession.getChapterView('John', 1);
  await apiSession.search('Word', { book: 'John' });
  assert.deepEqual(tokens, ['view-token', 'search-token']);

  const limited = await apiSession.validateVisibleContent({
    chapters: [1, 2, 3],
    verses: Array.from({ length: 30 }, (_, i) => i + 1),
  });
  assert.equal(limited.ok, false);

  const okByChapters = await apiSession.validateVisibleContent({
    chapters: [1, 2],
    verses: Array.from({ length: 40 }, (_, i) => i + 1),
  });
  assert.equal(okByChapters.ok, true);
});
