export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function normalizeAnswer(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('en-US');
}

export function sample(items, random = Math.random) {
  return items[Math.floor(random() * items.length)];
}

export function createBlankQuestion(verse, difficulty = 'medium', random = Math.random) {
  const words = verse.text.split(' ');
  const eligible = words
    .map((word, index) => ({ word, index }))
    .filter(({ word }) => normalizeAnswer(word).length >= 4);
  const ratios = { easy: 0.12, medium: 0.22, hard: 0.35 };
  const count = Math.max(1, Math.round(eligible.length * (ratios[difficulty] ?? ratios.medium)));
  const hidden = shuffle(eligible, random).slice(0, count);
  const answers = new Map(hidden.map(({ word, index }) => [index, normalizeAnswer(word)]));

  return { verse, words, answers, difficulty };
}

export function createVerseScramble(verse, random = Math.random) {
  const words = verse.text.split(' ');
  const chunkSize = words.length > 30 ? 3 : 2;
  const chunks = [];

  for (let index = 0; index < words.length; index += chunkSize) {
    chunks.push({
      id: `chunk-${chunks.length}`,
      text: words.slice(index, index + chunkSize).join(' '),
      order: chunks.length,
    });
  }

  let shuffled = shuffle(chunks, random);
  if (
    shuffled.length > 1 &&
    shuffled.every((chunk, index) => chunk.id === chunks[index].id)
  ) {
    shuffled = [...shuffled.slice(1), shuffled[0]];
  }

  return { verse, chunks, shuffled };
}

export function createJeopardyBoard(
  memoryVerses,
  uniqueWords,
  quizQuestions,
  mode = 'official',
  random = Math.random,
) {
  const officialCategory = (name, typeCode) => ({
    name,
    build: () => {
      const matching = quizQuestions.filter((question) => question.typeCode === typeCode);
      const question = sample(matching.length ? matching : quizQuestions, random);
      return {
        clue: question.question,
        answer: `${question.answer} (${question.reference})`,
      };
    },
  });

  const officialCategories = [
    officialCategory('According To', 'A'),
    officialCategory('General', 'G'),
    officialCategory('Quote', 'Q'),
    officialCategory('Situation', 'S'),
    officialCategory('Reference', 'X'),
  ];

  const drillCategories = [
    {
      name: 'References',
      build: (level) => {
        const verse = sample(memoryVerses, random);
        const lengths = [38, 56, 74, 96, 130];
        return {
          clue: `Name the reference: "${verse.text.slice(0, lengths[level])}${verse.text.length > lengths[level] ? '...' : ''}"`,
          answer: verse.reference,
        };
      },
    },
    {
      name: 'Finish the Verse',
      build: (level) => {
        const verse = sample(memoryVerses, random);
        const words = verse.text.split(' ');
        const shown = Math.max(3, Math.round(words.length * (0.7 - level * 0.09)));
        return {
          clue: `Finish ${verse.reference}: "${words.slice(0, shown).join(' ')} ..."`,
          answer: verse.text,
        };
      },
    },
    {
      name: 'Missing Words',
      build: () => {
        const verse = sample(memoryVerses, random);
        const words = verse.text.split(' ');
        const candidates = words
          .map((word, index) => ({ word, index }))
          .filter(({ word }) => normalizeAnswer(word).length >= 4);
        const missing = sample(candidates, random);
        words[missing.index] = '_____';
        return {
          clue: `Supply the missing word in ${verse.reference}: "${words.join(' ')}"`,
          answer: normalizeAnswer(missing.word),
        };
      },
    },
    {
      name: 'Jump Words',
      build: () => {
        const verse = sample(memoryVerses, random);
        return {
          clue: `What jump words help identify ${verse.reference}?`,
          answer: verse.jumpWords,
        };
      },
    },
    {
      name: 'Unique Words',
      build: () => {
        const record = sample(uniqueWords, random);
        return {
          clue: `Give the reference for the unique word "${record.word}".`,
          answer: record.reference,
        };
      },
    },
  ];

  const categories = mode === 'drills' ? drillCategories : officialCategories;
  return categories.map((category) => ({
    name: category.name,
    clues: Array.from({ length: 5 }, (_, level) => ({
      id: `${category.name}-${level}`,
      value: (level + 1) * 100,
      used: false,
      ...category.build(level),
    })),
  }));
}

const directions = [
  [1, 0],
  [0, 1],
  [1, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [-1, -1],
  [1, -1],
];

export function createWordSearch(records, size = 14, wordCount = 10, random = Math.random) {
  const words = shuffle(
    [...new Set(records.map(({ word }) => normalizeAnswer(word).replaceAll('-', '').toUpperCase()))],
    random,
  )
    .filter((word) => word.length >= 4 && word.length <= size)
    .slice(0, wordCount);
  const grid = Array.from({ length: size }, () => Array(size).fill(''));
  const placements = [];

  for (const word of words) {
    let placed = false;
    for (let attempt = 0; attempt < 250 && !placed; attempt += 1) {
      const [dx, dy] = sample(directions, random);
      const startX = Math.floor(random() * size);
      const startY = Math.floor(random() * size);
      const endX = startX + dx * (word.length - 1);
      const endY = startY + dy * (word.length - 1);

      if (endX < 0 || endX >= size || endY < 0 || endY >= size) continue;

      const cells = [...word].map((letter, index) => ({
        x: startX + dx * index,
        y: startY + dy * index,
        letter,
      }));
      if (cells.some(({ x, y, letter }) => grid[y][x] && grid[y][x] !== letter)) continue;

      cells.forEach(({ x, y, letter }) => {
        grid[y][x] = letter;
      });
      placements.push({ word, cells });
      placed = true;
    }
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  grid.forEach((row, y) =>
    row.forEach((letter, x) => {
      if (!letter) grid[y][x] = alphabet[Math.floor(random() * alphabet.length)];
    }),
  );

  return { size, grid, placements };
}

export function cellsOnLine(start, end) {
  const dx = Math.sign(end.x - start.x);
  const dy = Math.sign(end.y - start.y);
  const distanceX = Math.abs(end.x - start.x);
  const distanceY = Math.abs(end.y - start.y);

  if (!(distanceX === 0 || distanceY === 0 || distanceX === distanceY)) return [];
  const length = Math.max(distanceX, distanceY);
  return Array.from({ length: length + 1 }, (_, index) => ({
    x: start.x + dx * index,
    y: start.y + dy * index,
  }));
}
