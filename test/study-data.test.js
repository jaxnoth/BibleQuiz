import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const data = JSON.parse(
  await readFile(new URL('../web/data/study-data.json', import.meta.url), 'utf8'),
);

test('generated study data includes quiz practice questions', () => {
  assert.equal(data.quizQuestions.length, 791);
  assert.ok(
    data.quizQuestions.every(
      (question) =>
        question.id &&
        question.question &&
        question.answer &&
        question.reference &&
        Number.isInteger(question.chapter),
    ),
  );
});

test('quiz practice questions are limited to enabled chapters', () => {
  const enabled = new Set(data.metadata.enabledChapters);
  assert.ok(data.quizQuestions.every((question) => enabled.has(question.chapter)));
});

test('quiz practice uses only official questions', () => {
  assert.equal(data.metadata.questionSource, 'official');
  assert.ok(data.quizQuestions.every((question) => question.id.startsWith('official-')));
  assert.equal(
    data.quizQuestions.some((question) =>
      ['jump', 'unique'].some((term) =>
        question.type.toLocaleLowerCase('en-US').includes(term),
      ),
    ),
    false,
  );
});

test('quiz practice questions expose typeCode and Context typeName for X', () => {
  assert.ok(
    data.quizQuestions.every(
      (question) => question.typeCode && question.typeName && question.type === question.typeName,
    ),
  );
  const contextQuestions = data.quizQuestions.filter((question) => question.typeCode === 'X');
  assert.ok(contextQuestions.length > 0);
  assert.ok(contextQuestions.every((question) => question.typeName === 'Context'));
});

test('scripture chapters cover enabled John 1-5 with sequential verses', () => {
  assert.ok(Array.isArray(data.scriptureChapters));
  assert.deepEqual(
    data.scriptureChapters.map((chapter) => chapter.chapter),
    data.metadata.enabledChapters,
  );
  for (const chapter of data.scriptureChapters) {
    assert.ok(chapter.verses.length > 0);
    assert.equal(chapter.verses[0].verse, 1);
    for (let index = 1; index < chapter.verses.length; index += 1) {
      assert.ok(
        chapter.verses[index].verse > chapter.verses[index - 1].verse,
        `John ${chapter.chapter} verse order`,
      );
      assert.ok(chapter.verses[index].text.length > 0);
    }
  }
  assert.equal(data.metadata.distribution, 'internal-personal');
  assert.match(data.metadata.scriptureAttribution, /internal personal/i);
});

test('generated JSON contains no Unicode em dash', async () => {
  const source = await readFile(new URL('../web/data/study-data.json', import.meta.url), 'utf8');
  assert.equal(source.includes('\u2014'), false);
});
