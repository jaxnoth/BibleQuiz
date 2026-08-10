import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  cleanText,
  parseCsv,
  parseReference,
  parseScriptureChapter,
  questionTypes,
} from './study-data-lib.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = path.join(projectRoot, 'SourceMaterial');
const scriptureDirectory = path.join(sourceDirectory, 'Scripture');
const outputPath = path.join(projectRoot, 'web', 'data', 'study-data.json');
const enabledChapters = new Set([1, 2, 3, 4, 5]);

function assertUnique(records, key, label) {
  const seen = new Set();
  for (const record of records) {
    const value = key(record).toLocaleLowerCase('en-US');
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label}: ${value}`);
    }
    seen.add(value);
  }
}

async function loadCsv(filename) {
  const source = await readFile(path.join(sourceDirectory, filename), 'utf8');
  return parseCsv(source);
}

function decodeRtfText(value) {
  return cleanText(
    value
      .replace(/\\u(-?\d+)\?/g, (_, code) => {
        const numeric = Number(code);
        return String.fromCodePoint(numeric < 0 ? numeric + 65536 : numeric);
      })
      .replace(/\\'([0-9a-f]{2})/gi, (_, hex) =>
        new TextDecoder('windows-1252').decode(Uint8Array.of(Number.parseInt(hex, 16))),
      )
      .replace(/\\([\\{}])/g, '$1')
      .replace(/\\[a-z]+-?\d*\s?/gi, '')
      .replace(/[{}]/g, ''),
  );
}

function parseRtfQuestions(source, expectedChapter) {
  const questions = [];
  const pattern =
    /\\tx576\s+([A-Z])\\tab\s+(\d+)\.\s+([\s\S]*?)\\par\}\s*\{\\pard\\f0\\fs15\\li576\s+A\.\s+([\s\S]*?)\\par\}/g;

  for (const match of source.matchAll(pattern)) {
    const [, typeCode, number, encodedQuestion, encodedAnswer] = match;
    const question = decodeRtfText(encodedQuestion);
    const answerWithReference = decodeRtfText(encodedAnswer);
    const referenceMatch = answerWithReference.match(/\((John\s+\d+:\d+(?:-\d+)?[^)]*)\)\s*$/i);

    if (!referenceMatch) {
      throw new Error(`John ${expectedChapter} question ${number} has no trailing reference.`);
    }

    const primaryReference = referenceMatch[1].match(/John\s+\d+:\d+(?:-\d+)?/i)?.[0];
    const parsedReference = parseReference(primaryReference);
    if (parsedReference.chapter !== expectedChapter) {
      throw new Error(
        `John ${expectedChapter} question ${number} was assigned to ${parsedReference.reference}.`,
      );
    }

    const typeName = questionTypes[typeCode] ?? `Type ${typeCode}`;
    questions.push({
      id: `official-${expectedChapter}-${number}`,
      number: Number(number),
      question,
      answer: cleanText(answerWithReference.slice(0, referenceMatch.index)),
      reference: cleanText(referenceMatch[1]),
      chapter: parsedReference.chapter,
      type: typeName,
      typeCode,
      typeName,
    });
  }

  if (questions.length === 0) {
    throw new Error(`No official questions were parsed for John ${expectedChapter}.`);
  }

  return questions;
}

async function loadScriptureChapters() {
  const files = await readdir(scriptureDirectory);
  const chapters = [];

  for (const chapter of [...enabledChapters].sort((a, b) => a - b)) {
    const filename = `John ${chapter}.md`;
    if (!files.includes(filename)) {
      throw new Error(`Missing Scripture file: ${path.join('Scripture', filename)}`);
    }
    const relativePath = path.join('Scripture', filename);
    const source = await readFile(path.join(scriptureDirectory, filename), 'utf8');
    chapters.push(parseScriptureChapter(source, chapter, relativePath.replaceAll('\\', '/')));
  }

  return chapters;
}

const memoryRows = await loadCsv('memory-verses-2026-27.csv');
const uniqueWordRows = await loadCsv('unique-words-2026-27.csv');

const officialQuestionSets = await Promise.all(
  [...enabledChapters].map(async (chapter) => {
    const filename = path.join('Questions', `John-${chapter}`, 'questions-1.rtf');
    const source = await readFile(path.join(sourceDirectory, filename), 'utf8');
    return parseRtfQuestions(source, chapter);
  }),
);

const scriptureChapters = await loadScriptureChapters();

const allMemoryVerses = memoryRows.map((row) => ({
  ...parseReference(row.Verse),
  jumpWords: cleanText(row['Jump Words']),
  text: cleanText(row.Scripture),
}));

const allUniqueWords = uniqueWordRows.map((row) => ({
  word: cleanText(row.Word),
  ...parseReference(row.Verse),
}));

assertUnique(allMemoryVerses, (record) => record.reference, 'memory verse reference');
assertUnique(
  allUniqueWords,
  (record) => `${record.word}|${record.reference}`,
  'unique word and reference pair',
);

const memoryVerses = allMemoryVerses.filter((record) => enabledChapters.has(record.chapter));
const uniqueWords = allUniqueWords.filter((record) => enabledChapters.has(record.chapter));

if (memoryVerses.length === 0 || uniqueWords.length === 0) {
  throw new Error('The enabled chapter range produced no study data.');
}

const quizQuestions = officialQuestionSets.flat();
assertUnique(quizQuestions, (record) => `${record.question}|${record.reference}`, 'quiz question');

const sourceFiles = [
  'memory-verses-2026-27.csv',
  'unique-words-2026-27.csv',
  ...[...enabledChapters].map((chapter) => `John ${chapter}.zip`),
  ...[...enabledChapters].map(
    (chapter) => `Questions/John-${chapter}/questions-1.rtf`,
  ),
  ...[...enabledChapters].map((chapter) => `Scripture/John ${chapter}.md`),
];

const data = {
  metadata: {
    title: 'The Gospel of John',
    season: '2026-27',
    enabledChapters: [...enabledChapters],
    generatedAt: new Date().toISOString(),
    sourceFiles,
    questionSource: 'official',
    distribution: 'internal-personal',
    scriptureAttribution:
      'Scripture text retained for internal personal practice only. Confirm translation permission and required copyright notice before any public distribution.',
  },
  memoryVerses,
  uniqueWords,
  quizQuestions,
  scriptureChapters,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

const verseCount = scriptureChapters.reduce((total, chapter) => total + chapter.verses.length, 0);
console.log(
  `Generated ${path.relative(projectRoot, outputPath)} with ${memoryVerses.length} memory verses, ${uniqueWords.length} unique words, ${quizQuestions.length} quiz questions, and ${scriptureChapters.length} Scripture chapters (${verseCount} verses).`,
);
