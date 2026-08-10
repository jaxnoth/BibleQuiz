import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  findUniqueWordMatches,
  highlightUniqueWords,
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

test('renderScriptureVerses applies memory class and unique marks', () => {
  const html = renderScriptureVerses(
    [{ verse: 4, text: 'In him was life, and that life was the light of all mankind.' }],
    [{ verseStart: 4, verseEnd: 5 }],
    [{ word: 'light', verseStart: 4, verseEnd: 4 }],
    { showMemory: true, showUnique: true },
  );
  assert.match(html, /memory-verse/);
  assert.match(html, /<mark class="unique-word">light<\/mark>/);
});
