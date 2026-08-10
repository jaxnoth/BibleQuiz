import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  findJumpWordMatch,
  findUniqueWordMatches,
  highlightUniqueWords,
  highlightVerseText,
  normalizeJumpPhrase,
  renderScriptureVerses,
} from '../web/js/scripture-highlight.js';

test('unique word matches light forms but not lights', () => {
  const samples = ['light', 'Light', 'light,', '"light"', "light's", 'lights'];
  const expectedCounts = [1, 1, 1, 1, 1, 0];
  samples.forEach((sample, index) => {
    assert.equal(
      findUniqueWordMatches(sample, 'light').length,
      expectedCounts[index],
      sample,
    );
  });
});

test('highlightUniqueWords escapes markup before marking', () => {
  const html = highlightUniqueWords('<script>alert(1)</script> light', ['light']);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /<mark class="unique-word">light<\/mark>/);
});

test('escapeHtml encodes angle brackets', () => {
  assert.equal(escapeHtml('<b>'), '&lt;b&gt;');
});

test('normalizeJumpPhrase cleans CSV quote noise', () => {
  assert.equal(normalizeJumpPhrase('Jesus answered, ""Very'), 'Jesus answered, "Very');
  assert.equal(normalizeJumpPhrase('  The true  '), 'The true');
});

test('findJumpWordMatch prefers start of verse', () => {
  const text = 'In the beginning was the Word, and the Word was with God.';
  assert.deepEqual(findJumpWordMatch(text, 'In'), { start: 0, end: 2 });
  assert.deepEqual(findJumpWordMatch(text, 'The true'), null);
});

test('findJumpWordMatch tolerates curly quotes and multi-word phrases', () => {
  const text = 'Jesus answered them, \u201CDestroy this temple, and I will raise it again in three days.\u201D';
  const match = findJumpWordMatch(text, 'Jesus answered them');
  assert.deepEqual(match, { start: 0, end: 'Jesus answered them'.length });
});

test('findJumpWordMatch ignores quote characters inside the CSV jump phrase', () => {
  const text = 'Jesus answered, \u201CVery truly I tell you, no one can enter the kingdom of God';
  const match = findJumpWordMatch(text, 'Jesus answered, ""Very');
  assert.equal(match?.start, 0);
  assert.equal(text.slice(match.start, match.end), 'Jesus answered, \u201CVery');
});

test('highlightVerseText marks jump words and unique words without overlap clash', () => {
  const html = highlightVerseText('In him was life, and that life was the light of all mankind.', {
    jumpWords: 'In',
    uniqueWords: ['light'],
  });
  assert.match(html, /<mark class="jump-word">In<\/mark>/);
  assert.match(html, /<mark class="unique-word">light<\/mark>/);
});

test('renderScriptureVerses applies memory, jump, and unique marks', () => {
  const html = renderScriptureVerses(
    [{ verse: 4, text: 'In him was life, and that life was the light of all mankind.' }],
    [{ verseStart: 4, verseEnd: 5, jumpWords: 'In' }],
    [{ word: 'light', verseStart: 4, verseEnd: 4 }],
    { showMemory: true, showJump: true, showUnique: true },
  );
  assert.match(html, /memory-verse/);
  assert.match(html, /<mark class="jump-word">In<\/mark>/);
  assert.match(html, /<mark class="unique-word">light<\/mark>/);
});

test('renderScriptureVerses only marks jump words on verseStart', () => {
  const html = renderScriptureVerses(
    [
      { verse: 12, text: 'Yet to all who did receive him.' },
      { verse: 13, text: 'children born not of natural descent.' },
    ],
    [{ verseStart: 12, verseEnd: 13, jumpWords: 'Yet' }],
    [],
    { showJump: true, showUnique: false },
  );
  assert.match(html, /data-verse="12"[^>]*>.*<mark class="jump-word">Yet<\/mark>/s);
  assert.doesNotMatch(html, /data-verse="13"[^>]*>.*jump-word/s);
});
