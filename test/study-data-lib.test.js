import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanText,
  parseCsv,
  parseReference,
  parseScriptureChapter,
  questionTypes,
} from '../scripts/study-data-lib.mjs';

test('parseCsv maps headers and quoted commas', () => {
  const rows = parseCsv('Word,Verse\n"grace, truth",John 1:14\n');
  assert.deepEqual(rows, [{ Word: 'grace, truth', Verse: 'John 1:14' }]);
});

test('cleanText normalizes entities whitespace and em dash', () => {
  assert.equal(cleanText('  a&apos;b\u2014c  '), "a'b-c");
});

test('parseReference supports verse ranges', () => {
  assert.deepEqual(parseReference('John 3:16-17'), {
    reference: 'John 3:16-17',
    book: 'John',
    chapter: 3,
    verseStart: 16,
    verseEnd: 17,
  });
});

test('questionTypes maps X to Context', () => {
  assert.equal(questionTypes.X, 'Context');
});

test('parseScriptureChapter splits glued verses', () => {
  const chapter = parseScriptureChapter(
    'John 2\n1On the third day a wedding took place at Cana in Galilee.2Jesus and his disciples had also been invited to the wedding.',
    2,
    'Scripture/John 2.md',
  );
  assert.equal(chapter.chapter, 2);
  assert.equal(chapter.verses.length, 2);
  assert.equal(chapter.verses[0].verse, 1);
  assert.match(chapter.verses[0].text, /^On the third day/);
  assert.equal(chapter.verses[1].verse, 2);
});

test('parseScriptureChapter fails loud on repeated verse', () => {
  assert.throws(
    () =>
      parseScriptureChapter(
        'John 3\n1First verse.1Repeated number.',
        3,
        'Scripture/John 3.md',
      ),
    /expected verse 2, found verse 1/,
  );
});

test('parseScriptureChapter allows intentional gaps', () => {
  const chapter = parseScriptureChapter(
    'John 5\n1First.2Second.3Third.5Fifth after omitted fourth.',
    5,
    'Scripture/John 5.md',
  );
  assert.deepEqual(
    chapter.verses.map((verse) => verse.verse),
    [1, 2, 3, 5],
  );
});
