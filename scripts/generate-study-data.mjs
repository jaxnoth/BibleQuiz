import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = path.join(projectRoot, 'SourceMaterial');
const outputPath = path.join(projectRoot, 'web', 'data', 'study-data.json');
const enabledChapters = new Set([1, 2, 3, 4, 5]);

function parseCsv(source) {
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

function cleanText(value) {
  return value
    .replaceAll('&apos;', "'")
    .replaceAll('\u2014', '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseReference(value) {
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

const memoryRows = await loadCsv('memory-verses-2026-27.csv');
const uniqueWordRows = await loadCsv('unique-words-2026-27.csv');

const questionTypes = {
  A: 'According To',
  G: 'General',
  Q: 'Quote',
  S: 'Situation',
  X: 'Reference',
};

function decodeRtfText(value) {
  return cleanText(
    value
      .replace(/\\u(-?\d+)\?/g, (_, code) => {
        const value = Number(code);
        return String.fromCodePoint(value < 0 ? value + 65536 : value);
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

    questions.push({
      id: `official-${expectedChapter}-${number}`,
      number: Number(number),
      question,
      answer: cleanText(answerWithReference.slice(0, referenceMatch.index)),
      reference: cleanText(referenceMatch[1]),
      chapter: parsedReference.chapter,
      type: questionTypes[typeCode] ?? `Type ${typeCode}`,
      typeCode,
    });
  }

  if (questions.length === 0) {
    throw new Error(`No official questions were parsed for John ${expectedChapter}.`);
  }

  return questions;
}

const officialQuestionSets = await Promise.all(
  [...enabledChapters].map(async (chapter) => {
    const filename = path.join('Questions', `John-${chapter}`, 'questions-1.rtf');
    const source = await readFile(path.join(sourceDirectory, filename), 'utf8');
    return parseRtfQuestions(source, chapter);
  }),
);

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
];

const data = {
  metadata: {
    title: 'The Gospel of John',
    season: '2026-27',
    enabledChapters: [...enabledChapters],
    generatedAt: new Date().toISOString(),
    sourceFiles,
    questionSource: 'official',
  },
  memoryVerses,
  uniqueWords,
  quizQuestions,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

console.log(
  `Generated ${path.relative(projectRoot, outputPath)} with ${memoryVerses.length} memory verses, ${uniqueWords.length} unique words, and ${quizQuestions.length} quiz questions.`,
);
