export const MAX_RESULTS = 50;
export const CONCORDANCE_HIGHLIGHT_MS = 2500;

function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ')
    .trim();
}

function snippetAround(text, query) {
  const lower = text.toLocaleLowerCase('en-US');
  const needle = query.toLocaleLowerCase('en-US');
  const index = lower.indexOf(needle);
  if (index === -1) return text.slice(0, 80) + (text.length > 80 ? '...' : '');
  const start = Math.max(0, index - 24);
  const end = Math.min(text.length, index + needle.length + 24);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < text.length ? '...' : '';
  return `${prefix}${text.slice(start, end)}${suffix}`;
}

function textContainsQuery(text, query) {
  const haystack = normalizeSearch(text);
  const needle = normalizeSearch(query);
  if (!needle) return false;
  if (needle.includes(' ')) {
    return haystack.includes(needle);
  }
  const pattern = new RegExp(
    `(^|[^a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^a-z0-9])`,
    'i',
  );
  return pattern.test(haystack);
}

/**
 * Search Scripture chapter text. Empty query returns []. Cap at MAX_RESULTS.
 * Local search engine for LocalScriptureProvider only - UI must go through
 * scripture-session / provider, not call this from app routes.
 */
export function searchScripture(chapters, query, { chapterFilter, bookFilter } = {}) {
  const needle = normalizeSearch(query);
  if (!needle) return [];

  const results = [];
  for (const chapter of chapters ?? []) {
    if (
      bookFilter != null &&
      bookFilter !== 'all' &&
      String(chapter.book ?? '').toLocaleLowerCase('en-US') !==
        String(bookFilter).toLocaleLowerCase('en-US')
    ) {
      continue;
    }
    if (
      chapterFilter != null &&
      chapterFilter !== 'all' &&
      Number(chapter.chapter) !== Number(chapterFilter)
    ) {
      continue;
    }
    const book = chapter.book || 'John';
    for (const verse of chapter.verses ?? []) {
      if (!textContainsQuery(verse.text, needle)) continue;
      results.push({
        book,
        chapter: chapter.chapter,
        verse: verse.verse,
        reference: verse.reference ?? `${book} ${chapter.chapter}:${verse.verse}`,
        snippet: snippetAround(verse.text, needle),
      });
      if (results.length >= MAX_RESULTS) return results;
    }
  }
  return results;
}

/**
 * Filter unique-word bank by optional chapter and query.
 */
export function listUniqueWords(uniqueWords, { chapterFilter, query } = {}) {
  const needle = normalizeSearch(query);
  return (uniqueWords ?? [])
    .filter((record) => {
      if (
        chapterFilter != null &&
        chapterFilter !== 'all' &&
        Number(record.chapter) !== Number(chapterFilter)
      ) {
        return false;
      }
      if (!needle) return true;
      return normalizeSearch(record.word).includes(needle);
    })
    .slice(0, MAX_RESULTS);
}
