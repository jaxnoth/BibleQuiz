import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiBibleProvider } from '../web/js/api-bible-provider.js';

function mockFetch(handlers) {
  return async (url) => {
    const path = String(url).replace(/^.*\/api\/scripture/, '');
    const handler = handlers[path.split('?')[0]] || handlers['*'];
    if (!handler) {
      return { ok: false, status: 404, json: async () => ({ error: 'missing' }) };
    }
    const result = typeof handler === 'function' ? handler(url) : handler;
    return {
      ok: true,
      status: 200,
      json: async () => result,
    };
  };
}

test('ApiBibleProvider passes through metadata from proxy', async () => {
  const metadata = {
    provider: 'api.bible',
    translation: 'NIV',
    abbreviation: 'NIV',
    ipHolder: 'Biblica',
    ipHolderUrl: 'https://www.biblica.com',
    requiresBiblicaLink: true,
    capabilities: { fumRequired: true },
    limits: { maxVisibleChapters: 2, maxVisibleVerses: 25 },
  };
  const provider = createApiBibleProvider({
    fetchImpl: mockFetch({
      '/metadata': metadata,
    }),
  });
  const got = await provider.getMetadata();
  assert.equal(got.ipHolder, 'Biblica');
  assert.equal(got.requiresBiblicaLink, true);
  assert.equal(got.limits.maxVisibleChapters, 2);
});

test('ApiBibleProvider getChapter returns verses metadata and fumsToken without calling fums', async () => {
  let fumsCalled = false;
  globalThis.fums = () => {
    fumsCalled = true;
  };

  const provider = createApiBibleProvider({
    fetchImpl: mockFetch({
      '/chapter': {
        book: 'John',
        chapter: 1,
        verses: [{ verse: 1, text: 'In the beginning was the Word.', reference: 'John 1:1' }],
        metadata: { provider: 'api.bible', capabilities: { fumRequired: true } },
        fumsToken: 'token-abc',
      },
    }),
  });

  const chapter = await provider.getChapter('John', 1);
  assert.equal(chapter.verses.length, 1);
  assert.equal(chapter.fumsToken, 'token-abc');
  assert.equal(fumsCalled, false);
  delete globalThis.fums;
});

test('ApiBibleProvider search returns results and fumsToken', async () => {
  const provider = createApiBibleProvider({
    fetchImpl: mockFetch({
      '/search': {
        results: [
          {
            book: 'John',
            chapter: 1,
            verse: 1,
            reference: 'John 1:1',
            snippet: 'In the beginning',
          },
        ],
        fumsToken: 'search-token',
      },
    }),
  });
  const raw = await provider.search('beginning', { book: 'John', chapter: 1 });
  assert.equal(raw.results.length, 1);
  assert.equal(raw.fumsToken, 'search-token');
});
