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

function mergeRanges(ranges) {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [{ ...sorted[0] }];
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const last = merged[merged.length - 1];
    if (current.start < last.end) {
      if (current.end > last.end) last.end = current.end;
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

/**
 * Escape text, then wrap unique-word spans. Escape first is mandatory.
 */
export function highlightUniqueWords(text, uniqueWords) {
  const source = String(text);
  const ranges = [];
  for (const entry of uniqueWords) {
    const word = typeof entry === 'string' ? entry : entry.word;
    for (const match of findUniqueWordMatches(source, word)) {
      ranges.push(match);
    }
  }
  const merged = mergeRanges(ranges);
  if (!merged.length) return escapeHtml(source);

  let html = '';
  let cursor = 0;
  for (const range of merged) {
    html += escapeHtml(source.slice(cursor, range.start));
    html += `<mark class="unique-word">${escapeHtml(source.slice(range.start, range.end))}</mark>`;
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
 * Build HTML for one chapter with optional memory bands and unique-word marks.
 */
export function renderScriptureVerses(
  verses,
  memoryVerses,
  uniqueWords,
  { showMemory = true, showUnique = true } = {},
) {
  return verses
    .map((verse) => {
      const memory = showMemory && isMemoryVerse(verse.verse, memoryVerses);
      const words = showUnique ? uniqueWordsForVerse(verse.verse, uniqueWords) : [];
      const body = showUnique
        ? highlightUniqueWords(verse.text, words)
        : escapeHtml(verse.text);
      const classes = ['scripture-verse', memory ? 'memory-verse' : '']
        .filter(Boolean)
        .join(' ');
      const memoryLabel = memory
        ? ` data-memory="true" title="Memory verse"`
        : '';
      return `<p class="${classes}"${memoryLabel}><sup class="verse-number">${verse.verse}</sup> ${body}</p>`;
    })
    .join('');
}
