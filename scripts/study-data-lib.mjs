export const questionTypes = {
  A: 'According To',
  G: 'General',
  Q: 'Quote',
  S: 'Situation',
  X: 'Context',
};

export function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (character === '"') {
      if (quoted && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && nextCharacter === '\n') {
        index += 1;
      }
      row.push(field);
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (quoted) {
    throw new Error('CSV contains an unclosed quoted field.');
  }

  const [headers, ...records] = rows;
  return records.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), values[index] ?? ''])),
  );
}

export function cleanText(value) {
  return String(value)
    .replaceAll('&apos;', "'")
    .replaceAll('\u2014', '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseReference(value) {
  const reference = cleanText(value);
  const match = /^John\s+(\d+):(\d+)(?:-(\d+))?$/i.exec(reference);

  if (!match) {
    throw new Error(`Unsupported Bible reference: "${value}"`);
  }

  const chapter = Number(match[1]);
  const verseStart = Number(match[2]);
  const verseEnd = Number(match[3] ?? match[2]);

  return {
    reference: `John ${chapter}:${verseStart}${verseEnd === verseStart ? '' : `-${verseEnd}`}`,
    book: 'John',
    chapter,
    verseStart,
    verseEnd,
  };
}

/**
 * Parse glued-verse Scripture markdown: title line "John N" then continuous body
 * with verse numbers abutting text (1In the beginning...2He was...).
 */
export function parseScriptureChapter(source, expectedChapter, sourcePath = 'Scripture') {
  const normalized = String(source).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
  const titleMatch = /^John\s+(\d+)\s*\n?/i.exec(normalized);
  if (!titleMatch) {
    throw new Error(`Missing John chapter title in ${sourcePath}.`);
  }

  const chapter = Number(titleMatch[1]);
  if (chapter !== expectedChapter) {
    throw new Error(
      `Chapter mismatch in ${sourcePath}: expected John ${expectedChapter}, found John ${chapter}.`,
    );
  }

  const body = normalized.slice(titleMatch[0].length).trim();
  // Verse markers are glued to the following text (letter, quote, paren, etc.).
  const versePattern = /(\d+)(?=[^\d\s])/g;
  const starts = [...body.matchAll(versePattern)];
  if (starts.length === 0) {
    throw new Error(`No verses found in ${sourcePath}.`);
  }

  const verses = [];
  for (let index = 0; index < starts.length; index += 1) {
    const match = starts[index];
    const verse = Number(match[1]);
    if (index === 0 && verse !== 1) {
      throw new Error(
        `Invalid verse sequence in ${sourcePath}: expected verse 1, found verse ${verse}.`,
      );
    }
    const previous = verses[verses.length - 1];
    if (previous && verse <= previous.verse) {
      throw new Error(
        `Invalid verse sequence in ${sourcePath}: expected verse ${previous.verse + 1}, found verse ${verse}.`,
      );
    }
    // Intentional gaps (for example NIV John 5:4) are allowed when numbers increase.
    const textStart = match.index + match[1].length;
    const textEnd = index + 1 < starts.length ? starts[index + 1].index : body.length;
    const text = cleanText(body.slice(textStart, textEnd));
    if (!text) {
      throw new Error(`Empty verse ${verse} in ${sourcePath}.`);
    }
    verses.push({
      verse,
      text,
      reference: `John ${chapter}:${verse}`,
    });
  }

  return {
    book: 'John',
    chapter,
    verses,
  };
}
