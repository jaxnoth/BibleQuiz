import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createLocalScriptureProvider } from '../web/js/scripture-provider.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const studyData = JSON.parse(
  readFileSync(path.join(root, '../web/data/study-data.json'), 'utf8'),
);
const provider = createLocalScriptureProvider(studyData);

test('getMetadata returns provider source translation distribution capabilities limits', async () => {
  const metadata = await provider.getMetadata();
  assert.equal(metadata.provider, 'local');
  assert.equal(metadata.source, 'bundled-study-data');
  assert.equal(metadata.translation, 'NIV');
  assert.equal(metadata.abbreviation, 'NIV');
  assert.equal(metadata.distribution, 'internal-team');
  assert.match(metadata.scriptureAttribution, /internal personal/i);
  assert.equal(metadata.ipHolder, 'Biblica');
  assert.equal(metadata.ipHolderUrl, 'https://www.biblica.com');
  assert.equal(metadata.capabilities.search, true);
  assert.equal(metadata.capabilities.offline, true);
  assert.equal(metadata.capabilities.apiBible, false);
  assert.equal(metadata.capabilities.fumRequired, false);
  assert.equal(metadata.capabilities.aiUseAllowed, false);
  assert.equal(metadata.capabilities.textToSpeechAllowed, false);
  assert.equal(metadata.limits.maxVisibleChapters, null);
  assert.equal(metadata.limits.maxVisibleVerses, null);
  assert.equal(metadata.limits.requiresAttributionLink, false);
  assert.equal(metadata.limits.requiresSecureKeyHandling, false);
  assert.equal(metadata.requiresBiblicaLink, false);
});

test('listChapters returns John chapters only', async () => {
  const chapters = await provider.listChapters('John');
  assert.deepEqual(chapters, [1, 2, 3, 4, 5]);
});

test('unknown book listChapters returns empty array', async () => {
  assert.deepEqual(await provider.listChapters('Romans'), []);
});

test('getChapter returns John chapter verses and metadata', async () => {
  const chapter = await provider.getChapter('John', 1);
  assert.equal(chapter.book, 'John');
  assert.equal(chapter.chapter, 1);
  assert.ok(chapter.verses.length > 0);
  assert.equal(chapter.verses[0].verse, 1);
  assert.equal(chapter.metadata.provider, 'local');
  assert.equal(chapter.metadata.translation, 'NIV');
});

test('unknown book getChapter returns null', async () => {
  assert.equal(await provider.getChapter('Romans', 1), null);
});

test('missing chapter returns null', async () => {
  assert.equal(await provider.getChapter('John', 999), null);
});

test('search includes book chapter verse reference snippet', async () => {
  const results = await provider.search('Word', { book: 'John', chapter: 1 });
  assert.ok(results.length >= 1);
  assert.ok(results.every((row) => row.book === 'John'));
  assert.ok(results.every((row) => row.chapter === 1));
  assert.ok(results.every((row) => typeof row.verse === 'number'));
  assert.ok(results.every((row) => row.reference));
  assert.ok(results.every((row) => row.snippet));
});

test('search filtered by chapter only returns that chapter', async () => {
  const results = await provider.search('word', { book: 'John', chapter: 2 });
  assert.ok(results.every((row) => row.chapter === 2));
});

test('empty search returns no results', async () => {
  assert.deepEqual(await provider.search(''), []);
  assert.deepEqual(await provider.search('   '), []);
});

test('unknown book search returns empty array', async () => {
  assert.deepEqual(await provider.search('God', { book: 'Romans' }), []);
});
