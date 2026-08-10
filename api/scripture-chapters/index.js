'use strict';

const { apiBibleFetch } = require('../lib/api-bible-client');
const { resolveBookId } = require('../lib/books');
const { json, handleError } = require('../lib/http');

module.exports = async function (context, req) {
  try {
    const bookId = resolveBookId(req.query.book);
    if (!bookId) {
      const err = new Error('Unknown or missing book');
      err.status = 400;
      throw err;
    }

    const payload = await apiBibleFetch(`/bibles/{bibleId}/books/${bookId}/chapters`);
    const chapters = (payload.data || [])
      .map((row) => Number(row.number))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b);

    json(context, 200, { book: req.query.book, chapters });
  } catch (error) {
    handleError(context, error);
  }
};
