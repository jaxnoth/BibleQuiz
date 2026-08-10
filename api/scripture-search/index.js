'use strict';

const { apiBibleFetch, extractFumsToken } = require('../lib/api-bible-client');
const { resolveBookId, bookDisplayName } = require('../lib/books');
const { json, handleError } = require('../lib/http');

function parseVerseId(id) {
  // e.g. JHN.1.1
  const parts = String(id || '').split('.');
  if (parts.length < 3) return null;
  const bookId = parts[0];
  const chapter = Number(parts[1]);
  const verse = Number(parts[2]);
  if (!bookId || !Number.isFinite(chapter) || !Number.isFinite(verse)) return null;
  return { bookId, chapter, verse };
}

module.exports = async function (context, req) {
  try {
    const query = String(req.query.q || req.query.query || '').trim();
    if (!query) {
      json(context, 200, { results: [], fumsToken: null });
      return;
    }

    const bookId = req.query.book ? resolveBookId(req.query.book) : null;
    if (req.query.book && !bookId) {
      const err = new Error('Unknown book');
      err.status = 400;
      throw err;
    }

    const chapterFilter =
      req.query.chapter != null && req.query.chapter !== ''
        ? Number(req.query.chapter)
        : null;

    const searchParams = {
      query,
      'fums-version': '3',
      limit: '50',
    };
    if (bookId) searchParams['book-id'] = bookId;

    const payload = await apiBibleFetch('/bibles/{bibleId}/search', { searchParams });
    const verses = payload.data?.verses || payload.data || [];
    const list = Array.isArray(verses) ? verses : [];

    const results = [];
    for (const row of list) {
      const parsed = parseVerseId(row.id || row.verseId);
      if (!parsed) continue;
      if (chapterFilter != null && Number.isFinite(chapterFilter) && parsed.chapter !== chapterFilter) {
        continue;
      }
      const book = bookDisplayName(parsed.bookId);
      const text = String(row.text || row.content || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      results.push({
        book,
        chapter: parsed.chapter,
        verse: parsed.verse,
        reference: row.reference || `${book} ${parsed.chapter}:${parsed.verse}`,
        snippet: text.slice(0, 160),
      });
    }

    json(context, 200, {
      results,
      fumsToken: extractFumsToken(payload),
    });
  } catch (error) {
    handleError(context, error);
  }
};
