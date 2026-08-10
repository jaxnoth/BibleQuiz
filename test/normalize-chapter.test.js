import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));
const { normalizeChapterContent, parseHtmlVerses } = require(
  path.join(root, '../api/lib/normalize-chapter.js'),
);

test('normalizeChapterContent parses json verse tree', () => {
  const content = {
    name: 'chapter',
    items: [
      {
        name: 'paragraph',
        items: [
          { name: 'verse', number: 1, items: [{ name: 'text', text: 'In the beginning was the Word.' }] },
          { name: 'verse', number: 2, items: [{ name: 'text', text: 'He was with God.' }] },
        ],
      },
    ],
  };
  const verses = normalizeChapterContent(content, { book: 'John', chapter: 1 });
  assert.equal(verses.length, 2);
  assert.equal(verses[0].verse, 1);
  assert.equal(verses[0].text, 'In the beginning was the Word.');
  assert.equal(verses[0].reference, 'John 1:1');
  assert.equal(verses[1].verse, 2);
});

test('normalizeChapterContent parses html verse spans', () => {
  const html =
    '<p><span data-number="16" class="v"><span class="v">16</span>For God so loved the world.</span></p>';
  const verses = parseHtmlVerses(html, 'John', 3);
  assert.ok(verses.length >= 1);
  assert.equal(verses[0].verse, 16);
  assert.match(verses[0].text, /For God so loved the world/);
});

test('normalizeChapterContent parses plain text verses', () => {
  const text = '1 In the beginning was the Word.\n2 He was with God in the beginning.';
  const verses = normalizeChapterContent(text, { book: 'John', chapter: 1 });
  assert.equal(verses.length, 2);
  assert.equal(verses[1].reference, 'John 1:2');
});
