'use strict';

const { apiBibleFetch, extractFumsToken, getBibleMetadata } = require('../lib/api-bible-client');
const { resolveBookId, bookDisplayName } = require('../lib/books');
const { buildApiMetadata } = require('../lib/metadata');
const { normalizeChapterContent } = require('../lib/normalize-chapter');
const { json, handleError } = require('../lib/http');

module.exports = async function (context, req) {
  try {
    const bookId = resolveBookId(req.query.book);
    const chapterNumber = Number(req.query.chapter);
    if (!bookId || !Number.isFinite(chapterNumber) || chapterNumber < 1) {
      const err = new Error('book and chapter are required');
      err.status = 400;
      throw err;
    }

    const chapterId = `${bookId}.${chapterNumber}`;
    let payload = await apiBibleFetch(`/bibles/{bibleId}/chapters/${chapterId}`, {
      searchParams: {
        'content-type': 'json',
        'include-notes': 'false',
        'include-titles': 'false',
        'include-chapter-numbers': 'false',
        'include-verse-numbers': 'false',
        'fums-version': '3',
      },
    });

    const data = payload.data || {};
    const bookName = bookDisplayName(bookId);
    let verses = normalizeChapterContent(data.content, {
      book: bookName,
      chapter: chapterNumber,
    });

    if (!verses.length) {
      payload = await apiBibleFetch(`/bibles/{bibleId}/chapters/${chapterId}`, {
        searchParams: {
          'content-type': 'html',
          'include-verse-spans': 'true',
          'include-verse-numbers': 'true',
          'include-titles': 'false',
          'include-notes': 'false',
          'fums-version': '3',
        },
      });
      verses = normalizeChapterContent(payload.data?.content, {
        book: bookName,
        chapter: chapterNumber,
      });
    }

    const bibleInfo = await getBibleMetadata();
    const metadata = buildApiMetadata({
      ...bibleInfo,
      copyright: payload.data?.copyright || bibleInfo.copyright || '',
    });

    json(context, 200, {
      book: bookName,
      chapter: chapterNumber,
      verses,
      metadata,
      fumsToken: extractFumsToken(payload),
    });
  } catch (error) {
    handleError(context, error);
  }
};
