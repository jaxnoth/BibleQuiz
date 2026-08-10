export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/**
 * Find case-insensitive whole-word matches for `word` in `text`.
 * Matches light / Light / light, / "light" / light's; does not match lights.
 */
export function findUniqueWordMatches(text, word) {
  const needle = String(word);
  if (!needle) return [];
  const matches = [];
  const lowerText = text.toLocaleLowerCase('en-US');
  const lowerNeedle = needle.toLocaleLowerCase('en-US');
  let from = 0;

  while (from <= lowerText.length - lowerNeedle.length) {
    const index = lowerText.indexOf(lowerNeedle, from);
    if (index === -1) break;
    const before = index === 0 ? '' : lowerText[index - 1];
    const afterIndex = index + lowerNeedle.length;
    const after = afterIndex >= lowerText.length ? '' : lowerText[afterIndex];
    const beforeOk = !/[a-z0-9]/i.test(before);
    const afterOk = !/[a-z0-9]/i.test(after);
    if (beforeOk && afterOk) {
      matches.push({ start: index, end: afterIndex });
    }
    from = index + 1;
  }

  return matches;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalize jump-word CSV quirks (extra quotes, curly quotes) for matching.
 */
export function normalizeJumpPhrase(jumpWords) {
  return String(jumpWords || '')
    .replace(/[\u2018\u2019\u201C\u201D]/g, '"')
    .replace(/"+/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^"+|"+$/g, '')
    .trim();
}

/**
 * Find the jump-word phrase in verse text. Prefers a start-of-verse match
 * (optional leading quotes/whitespace), then falls back to the first hit.
 */
export function findJumpWordMatch(text, jumpWords) {
  const phrase = normalizeJumpPhrase(jumpWords);
  if (!phrase) return null;

  // Quotes are separators, not required tokens - CSV/API text disagree on curly vs straight.
  const words = phrase
    .split(' ')
    .map((word) => word.replace(/[\u2018\u2019\u201C\u201D"']/g, ''))
    .filter(Boolean);
  if (!words.length) return null;

  const wordPattern = words.map((word) => escapeRegExp(word)).join('[\\s\\u201C\\u201D"\',]*');
  const body = `([\\s\\u201C\\u201D"']*${wordPattern})`;
  const flags = 'iu';

  const startMatch = text.match(new RegExp(`^[\\s\\u201C\\u201D"']*${body}`, flags));
  if (startMatch) {
    const matched = startMatch[1];
    const start = startMatch[0].length - matched.length;
    const trimmedStart = start + matched.search(/\S/);
    const end = startMatch[0].length;
    return { start: trimmedStart, end };
  }

  const anyMatch = text.match(new RegExp(body, flags));
  if (!anyMatch) return null;
  const matched = anyMatch[1];
  const start = anyMatch.index + matched.search(/\S/);
  const end = anyMatch.index + matched.length;
  return { start, end };
}

/**
 * Escape text, then wrap unique-word spans. Escape first is mandatory.
 */
export function highlightUniqueWords(text, uniqueWords) {
  return highlightVerseText(text, { uniqueWords });
}

/**
 * Escape text, then wrap jump-word and unique-word spans.
 * Jump ranges win over unique when they overlap.
 */
export function highlightVerseText(text, { jumpWords = '', uniqueWords = [] } = {}) {
  const source = String(text);
  const tagged = [];

  const jumpMatch = findJumpWordMatch(source, jumpWords);
  if (jumpMatch) {
    tagged.push({ ...jumpMatch, kind: 'jump' });
  }

  for (const entry of uniqueWords) {
    const word = typeof entry === 'string' ? entry : entry.word;
    for (const match of findUniqueWordMatches(source, word)) {
      tagged.push({ ...match, kind: 'unique' });
    }
  }

  if (!tagged.length) return escapeHtml(source);

  // Jump first, then unique; skip any range that overlaps covered text.
  const ordered = [
    ...tagged.filter((range) => range.kind === 'jump'),
    ...tagged.filter((range) => range.kind === 'unique'),
  ];
  const accepted = [];
  for (const range of ordered) {
    const overlaps = accepted.some(
      (existing) => range.start < existing.end && range.end > existing.start,
    );
    if (!overlaps) accepted.push(range);
  }

  const sorted = accepted.sort((a, b) => a.start - b.start || a.end - b.end);
  let html = '';
  let cursor = 0;
  for (const range of sorted) {
    html += escapeHtml(source.slice(cursor, range.start));
    const className = range.kind === 'jump' ? 'jump-word' : 'unique-word';
    html += `<mark class="${className}">${escapeHtml(source.slice(range.start, range.end))}</mark>`;
    cursor = range.end;
  }
  html += escapeHtml(source.slice(cursor));
  return html;
}

export function isMemoryVerse(verseNumber, memoryVerses) {
  return memoryVerses.some(
    (record) => verseNumber >= record.verseStart && verseNumber <= record.verseEnd,
  );
}

export function uniqueWordsForVerse(verseNumber, uniqueWords) {
  return uniqueWords.filter(
    (record) => verseNumber >= record.verseStart && verseNumber <= record.verseEnd,
  );
}

/**
 * Jump words apply to the opening verse of a memory range only.
 */
export function jumpWordsForVerse(verseNumber, memoryVerses) {
  const record = memoryVerses.find(
    (entry) => Number(entry.verseStart) === Number(verseNumber) && entry.jumpWords,
  );
  return record?.jumpWords ?? '';
}

/**
 * Build HTML for one chapter with optional memory bands, jump words, and unique-word marks.
 */
export function renderScriptureVerses(
  verses,
  memoryVerses,
  uniqueWords,
  { showMemory = true, showJump = true, showUnique = true, focusVerse = null } = {},
) {
  return verses
    .map((verse) => {
      const memory = showMemory && isMemoryVerse(verse.verse, memoryVerses);
      const words = showUnique ? uniqueWordsForVerse(verse.verse, uniqueWords) : [];
      const jumpWords = showJump ? jumpWordsForVerse(verse.verse, memoryVerses) : '';
      const body =
        showJump || showUnique
          ? highlightVerseText(verse.text, {
              jumpWords,
              uniqueWords: words,
            })
          : escapeHtml(verse.text);
      const focused = focusVerse != null && Number(focusVerse) === Number(verse.verse);
      const classes = [
        'scripture-verse',
        memory ? 'memory-verse' : '',
        focused ? 'concordance-focus' : '',
      ]
        .filter(Boolean)
        .join(' ');
      const memoryLabel = memory
        ? ` data-memory="true" title="Memory verse"`
        : '';
      return `<p class="${classes}" data-verse="${verse.verse}"${memoryLabel}><sup class="verse-number">${verse.verse}</sup> ${body}</p>`;
    })
    .join('');
}
