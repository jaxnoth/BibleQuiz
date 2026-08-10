import test from 'node:test';
import assert from 'node:assert/strict';
import { createHybridScriptureProvider } from '../web/js/hybrid-scripture-provider.js';

const studyData = {
  metadata: {
    translation: 'NIV',
    abbreviation: 'NIV',
    source: 'bundled-study-data',
    distribution: 'internal-team',
  },
  scriptureChapters: [
    {
      book: 'John',
      chapter: 1,
      verses: [{ verse: 1, text: 'Local only verse.', reference: 'John 1:1' }],
    },
  ],
  memoryVerses: [],
  uniqueWords: [],
};

test('hybrid listChapters prefers API full John range', async () => {
  const provider = createHybridScriptureProvider(studyData, {
    fetchImpl: async (url) => {
      const path = String(url);
      if (path.includes('/chapters')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            book: 'John',
            chapters: Array.from({ length: 21 }, (_, i) => i + 1),
          }),
        };
      }
      return { ok: false, status: 500, json: async () => ({}) };
    },
  });
  const chapters = await provider.listChapters('John');
  assert.equal(chapters.length, 21);
  assert.equal(chapters[20], 21);
});

test('hybrid getChapter falls back to Local when API fails', async () => {
  const provider = createHybridScriptureProvider(studyData, {
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
  });
  const chapter = await provider.getChapter('John', 1);
  assert.equal(chapter.verses[0].text, 'Local only verse.');
});

test('hybrid getChapter uses API text for chapters beyond Local', async () => {
  const provider = createHybridScriptureProvider(studyData, {
    fetchImpl: async (url) => {
      if (String(url).includes('/chapter?')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            book: 'John',
            chapter: 21,
            verses: [{ verse: 25, text: 'Amen.', reference: 'John 21:25' }],
            metadata: { provider: 'api.bible' },
            fumsToken: 't',
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    },
  });
  const chapter = await provider.getChapter('John', 21);
  assert.equal(chapter.chapter, 21);
  assert.equal(chapter.verses[0].reference, 'John 21:25');
});
