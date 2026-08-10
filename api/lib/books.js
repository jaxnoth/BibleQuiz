'use strict';

/** Study book display name -> API.Bible book id */
const BOOK_IDS = {
  John: 'JHN',
};

const BOOK_NAMES = Object.fromEntries(
  Object.entries(BOOK_IDS).map(([name, id]) => [id, name]),
);

function resolveBookId(book) {
  const raw = String(book ?? '').trim();
  if (!raw) return null;
  if (BOOK_IDS[raw]) return BOOK_IDS[raw];
  const upper = raw.toUpperCase();
  if (BOOK_NAMES[upper]) return upper;
  const match = Object.keys(BOOK_IDS).find(
    (name) => name.toLocaleLowerCase('en-US') === raw.toLocaleLowerCase('en-US'),
  );
  return match ? BOOK_IDS[match] : null;
}

function bookDisplayName(bookId) {
  return BOOK_NAMES[bookId] || bookId;
}

module.exports = {
  BOOK_IDS,
  resolveBookId,
  bookDisplayName,
};
