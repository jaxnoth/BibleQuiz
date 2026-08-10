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

export function createBlankQuestion(verse, blankRatio = 0.22, random = Math.random) {
  const ratio = Math.max(0, Math.min(1, Number(blankRatio) || 0));
  const words = verse.text.split(' ');
  let hidden;

  if (ratio === 0) {
    hidden = [];
  } else if (ratio === 1) {
    hidden = words.map((word, index) => ({ word, index }));
  } else {
    const eligible = words
      .map((word, index) => ({ word, index }))
      .filter(({ word }) => normalizeAnswer(word).length >= 4);
    const count = Math.max(1, Math.round(eligible.length * ratio));
    hidden = shuffle(eligible, random).slice(0, Math.min(count, eligible.length));
  }

  const answers = new Map(hidden.map(({ word, index }) => [index, normalizeAnswer(word)]));

  return { verse, words, answers, blankRatio: ratio };
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
    officialCategory('Context', 'X'),
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

const WORD_SEARCH_DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [-1, -1],
  [1, -1],
];

/** ~2.1 letter cells per word letter - same budget idea as Trivia printables. */
export const WORD_SEARCH_LETTER_CELL_RATIO = 2.1;

export const WORD_SEARCH_DIFFICULTY = {
  easy: { count: 7, minSize: 10, maxSize: 12 },
  medium: { count: 10, minSize: 13, maxSize: 15 },
  hard: { count: 13, minSize: 16, maxSize: 18 },
};

const WORD_SEARCH_MIN_DIAGONAL_RATIO = 0.3;
const WORD_SEARCH_MAX_DIRECTION_SHARE = 0.35;
const WORD_SEARCH_MAX_OVERLAPS_PER_WORD = 2;
const WORD_SEARCH_MAX_BUILDS = 40;
const WORD_SEARCH_MIN_BUILDS_BEFORE_SOFT = 12;
const WORD_SEARCH_SAMPLES_PER_WORD = 250;

export function normalizeWordSearchWord(value) {
  return normalizeAnswer(value).replaceAll('-', '').replaceAll(' ', '').toUpperCase();
}

export function wordSearchGridSize(wordLengths, { minSize, maxSize } = {}) {
  const lengths = wordLengths.filter((length) => length > 0);
  const longest = lengths.length ? Math.max(...lengths) : 4;
  const low = Math.max(minSize ?? longest, longest);
  const high = Math.max(low, maxSize ?? low);
  if (!lengths.length) return low;
  const letterBudget = lengths.reduce((total, length) => total + length, 0) * WORD_SEARCH_LETTER_CELL_RATIO;
  const raw = Math.round(Math.sqrt(letterBudget));
  return Math.max(low, Math.min(high, raw));
}

function cellKey(x, y) {
  return `${x},${y}`;
}

function directionsParallel(a, b) {
  return (a[0] === b[0] && a[1] === b[1]) || (a[0] === -b[0] && a[1] === -b[1]);
}

function isDiagonalDirection(dx, dy) {
  return dx !== 0 && dy !== 0;
}

function makeWordCoords(startX, startY, dx, dy, length, size) {
  const endX = startX + dx * (length - 1);
  const endY = startY + dy * (length - 1);
  if (
    startX < 0 ||
    startY < 0 ||
    startX >= size ||
    startY >= size ||
    endX < 0 ||
    endY < 0 ||
    endX >= size ||
    endY >= size
  ) {
    return null;
  }
  return Array.from({ length }, (_, index) => ({
    x: startX + dx * index,
    y: startY + dy * index,
  }));
}

function validateWordPlacement(word, coords, direction, occupied, cellDirs) {
  let overlaps = 0;
  for (let index = 0; index < coords.length; index += 1) {
    const { x, y } = coords[index];
    const key = cellKey(x, y);
    const existing = occupied.get(key);
    if (existing != null) {
      if (existing !== word[index]) return null;
      const dirs = cellDirs.get(key) || [];
      if (dirs.some((dir) => directionsParallel(direction, dir))) return null;
      if (dirs.length >= 2) return null;
      overlaps += 1;
    }
  }
  if (overlaps > WORD_SEARCH_MAX_OVERLAPS_PER_WORD) return null;
  return overlaps;
}

function localDensity(coords, occupied, radius = 2) {
  let nearby = 0;
  const seen = new Set();
  for (const { x, y } of coords) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const key = cellKey(x + dx, y + dy);
        if (seen.has(key)) continue;
        seen.add(key);
        if (occupied.has(key)) nearby += 1;
      }
    }
  }
  return nearby;
}

function scoreWordOption(coords, overlaps, direction, dirCounts, occupied, random) {
  let score = 0;
  if (overlaps === 1) score += 8;
  else if (overlaps >= 2) score -= 10 * (overlaps - 1);
  if (overlaps === 0) score += 6;
  const dirKey = direction.join(',');
  score += Math.max(0, 5 - (dirCounts.get(dirKey) || 0)) * 8;
  if (isDiagonalDirection(direction[0], direction[1])) score += 10;
  score -= localDensity(coords, occupied, 2) * 2.5;
  score += random();
  return score;
}

function sampleWordOptions(word, size, occupied, cellDirs, random) {
  const options = [];
  const length = word.length;
  const letterCells = new Map();
  for (const [key, letter] of occupied) {
    if (!letterCells.has(letter)) letterCells.set(letter, []);
    letterCells.get(letter).push(key);
  }

  const seeds = [];
  for (let index = 0; index < length; index += 1) {
    for (const key of letterCells.get(word[index]) || []) {
      const [x, y] = key.split(',').map(Number);
      seeds.push({ index, x, y });
    }
  }
  for (const seed of shuffle(seeds, random).slice(0, 200)) {
    for (const [dx, dy] of WORD_SEARCH_DIRECTIONS) {
      const startX = seed.x - dx * seed.index;
      const startY = seed.y - dy * seed.index;
      const coords = makeWordCoords(startX, startY, dx, dy, length, size);
      if (!coords) continue;
      const overlaps = validateWordPlacement(word, coords, [dx, dy], occupied, cellDirs);
      if (overlaps == null) continue;
      options.push({ coords, overlaps, direction: [dx, dy] });
    }
  }

  for (let attempt = 0; attempt < WORD_SEARCH_SAMPLES_PER_WORD; attempt += 1) {
    const [dx, dy] = sample(WORD_SEARCH_DIRECTIONS, random);
    const startX = Math.floor(random() * size);
    const startY = Math.floor(random() * size);
    const coords = makeWordCoords(startX, startY, dx, dy, length, size);
    if (!coords) continue;
    const overlaps = validateWordPlacement(word, coords, [dx, dy], occupied, cellDirs);
    if (overlaps == null) continue;
    options.push({ coords, overlaps, direction: [dx, dy] });
  }

  const unique = new Map();
  for (const option of options) {
    unique.set(option.coords.map(({ x, y }) => cellKey(x, y)).join('|'), option);
  }
  return [...unique.values()];
}

export function countWordInGrid(grid, word) {
  const size = grid.length;
  let count = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      for (const [dx, dy] of WORD_SEARCH_DIRECTIONS) {
        const coords = makeWordCoords(x, y, dx, dy, word.length, size);
        if (!coords) continue;
        if (coords.every((cell, index) => grid[cell.y][cell.x] === word[index])) count += 1;
      }
    }
  }
  return count;
}

export function analyzeWordSearchPlacements(placements) {
  const dirCounts = new Map();
  const cellWords = new Map();
  const cellDirs = new Map();
  let collinearShares = 0;

  for (const placement of placements) {
    const direction = placement.direction;
    const dirKey = direction.join(',');
    dirCounts.set(dirKey, (dirCounts.get(dirKey) || 0) + 1);
    for (const { x, y } of placement.cells) {
      const key = cellKey(x, y);
      if (!cellWords.has(key)) cellWords.set(key, []);
      if (!cellDirs.has(key)) cellDirs.set(key, []);
      for (const existing of cellDirs.get(key)) {
        if (directionsParallel(direction, existing)) collinearShares += 1;
      }
      cellWords.get(key).push(placement.word);
      cellDirs.get(key).push(direction);
    }
  }

  const total = placements.length || 1;
  let diagonal = 0;
  for (const [key, count] of dirCounts) {
    const [dx, dy] = key.split(',').map(Number);
    if (isDiagonalDirection(dx, dy)) diagonal += count;
  }
  const maxDirectionShare = Math.max(0, ...dirCounts.values()) / total;
  return {
    dirCounts: Object.fromEntries(dirCounts),
    diagonalRatio: diagonal / total,
    maxDirectionShare,
    directionsUsed: dirCounts.size,
    collinearShares,
    sharedCells: [...cellWords.values()].filter((words) => words.length > 1).length,
  };
}

function meetsWordSearchQuality(stats, wordCount) {
  const minDirections = wordCount >= 8 ? 8 : Math.min(6, wordCount);
  return (
    stats.directionsUsed >= minDirections &&
    stats.diagonalRatio >= WORD_SEARCH_MIN_DIAGONAL_RATIO &&
    stats.maxDirectionShare <= WORD_SEARCH_MAX_DIRECTION_SHARE &&
    stats.collinearShares === 0
  );
}

function softPassWordSearch(stats, uniqueOk) {
  return uniqueOk && stats.collinearShares === 0;
}

function qualityScore(stats, placedCount, requestedCount) {
  const completeBonus = placedCount === requestedCount ? 40 : placedCount * 2;
  return (
    completeBonus +
    Math.round(stats.diagonalRatio * 100) +
    stats.directionsUsed * 8 -
    Math.round(stats.maxDirectionShare * 100) -
    stats.collinearShares * 50 +
    Math.min(12, stats.sharedCells) * 2
  );
}

function buildWordSearchOnce(words, size, random) {
  const grid = Array.from({ length: size }, () => Array(size).fill(''));
  const occupied = new Map();
  const cellDirs = new Map();
  const dirCounts = new Map();
  const placements = [];
  const ordered = [...words].sort((a, b) => b.length - a.length || a.localeCompare(b));

  for (const word of ordered) {
    const options = sampleWordOptions(word, size, occupied, cellDirs, random);
    if (!options.length) return null;

    const ranked = options
      .map((option) => ({
        ...option,
        score: scoreWordOption(
          option.coords,
          option.overlaps,
          option.direction,
          dirCounts,
          occupied,
          random,
        ),
      }))
      .sort((a, b) => b.score - a.score);

    const sparse = ranked.filter((option) => option.overlaps === 0).slice(0, 10);
    const crossed = ranked.filter((option) => option.overlaps > 0).slice(0, 6);
    const preferSparse = placements.length < 4 || random() < 0.45;
    let pool = preferSparse
      ? [...sparse, ...crossed.slice(0, 2)]
      : [...crossed, ...sparse.slice(0, 4)];
    if (!pool.length) pool = ranked.slice(0, 8);
    const chosen = sample(pool, random);

    const cells = chosen.coords.map(({ x, y }, index) => ({
      x,
      y,
      letter: word[index],
    }));
    for (const cell of cells) {
      grid[cell.y][cell.x] = cell.letter;
      const key = cellKey(cell.x, cell.y);
      occupied.set(key, cell.letter);
      if (!cellDirs.has(key)) cellDirs.set(key, []);
      cellDirs.get(key).push(chosen.direction);
    }
    const dirKey = chosen.direction.join(',');
    dirCounts.set(dirKey, (dirCounts.get(dirKey) || 0) + 1);
    placements.push({ word, cells, direction: chosen.direction });
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!grid[y][x]) grid[y][x] = alphabet[Math.floor(random() * alphabet.length)];
    }
  }

  const uniqueOk = placements.every(({ word }) => countWordInGrid(grid, word) === 1);
  const stats = analyzeWordSearchPlacements(placements);
  return {
    size,
    grid,
    placements,
    stats,
    uniqueOk,
    quality: meetsWordSearchQuality(stats, words.length),
    softPass: softPassWordSearch(stats, uniqueOk),
    score: qualityScore(stats, placements.length, words.length) + (uniqueOk ? 20 : -40),
  };
}

function resolveWordSearchArgs(sizeOrOptions, wordCountOrRandom, maybeRandom) {
  if (typeof sizeOrOptions === 'object' && sizeOrOptions !== null) {
    return {
      options: sizeOrOptions,
      random: typeof wordCountOrRandom === 'function' ? wordCountOrRandom : Math.random,
    };
  }
  return {
    options: {
      size: sizeOrOptions,
      wordCount: typeof wordCountOrRandom === 'number' ? wordCountOrRandom : 10,
    },
    random: typeof maybeRandom === 'function' ? maybeRandom : Math.random,
  };
}

/**
 * Build an interactive square word search with Trivia-inspired quality gates:
 * crossing-only letter shares, direction mix, uniqueness after fill, regenerate/best-of.
 *
 * Signature:
 * - createWordSearch(records, size, wordCount, random)
 * - createWordSearch(records, { wordCount, minSize, maxSize, size?, difficulty? }, random)
 */
export function createWordSearch(records, sizeOrOptions = 14, wordCountOrRandom = 10, maybeRandom = Math.random) {
  const { options, random } = resolveWordSearchArgs(sizeOrOptions, wordCountOrRandom, maybeRandom);
  const difficulty = options.difficulty ? WORD_SEARCH_DIFFICULTY[options.difficulty] : null;
  const wordCount = options.wordCount ?? difficulty?.count ?? 10;
  const minSize = options.minSize ?? difficulty?.minSize ?? 4;
  const maxSize = options.maxSize ?? difficulty?.maxSize ?? 24;

  const pool = shuffle(
    [
      ...new Set(
        records
          .map(({ word }) => normalizeWordSearchWord(word))
          .filter((word) => word.length >= 4),
      ),
    ],
    random,
  );

  const tentative = pool.slice(0, wordCount);
  const size =
    options.size != null
      ? Math.max(options.size, Math.max(0, ...tentative.map((word) => word.length)))
      : wordSearchGridSize(
          tentative.map((word) => word.length),
          { minSize, maxSize },
        );

  const words = pool.filter((word) => word.length <= size).slice(0, wordCount);
  if (!words.length) {
    return { size, grid: Array.from({ length: size }, () => Array(size).fill('A')), placements: [] };
  }

  let best = null;
  for (let attempt = 0; attempt < WORD_SEARCH_MAX_BUILDS; attempt += 1) {
    const built = buildWordSearchOnce(words, size, random);
    if (!built || built.placements.length !== words.length) continue;
    if (built.quality && built.uniqueOk) {
      return {
        size: built.size,
        grid: built.grid,
        placements: built.placements,
        stats: built.stats,
        quality: true,
      };
    }
    if (built.softPass && (!best || built.score > best.score)) best = built;
    else if (!best || built.score > best.score) best = built;

    // Keep the UI responsive: after enough tries, accept a soft-pass with a usable diagonal mix.
    if (
      attempt + 1 >= WORD_SEARCH_MIN_BUILDS_BEFORE_SOFT &&
      best?.softPass &&
      best.stats.diagonalRatio >= 0.25
    ) {
      break;
    }
  }

  if (best) {
    return {
      size: best.size,
      grid: best.grid,
      placements: best.placements,
      stats: best.stats,
      quality: Boolean(best.quality && best.uniqueOk),
    };
  }

  // Last resort: empty placements should be rare; keep a filled board for UI.
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return {
    size,
    grid: Array.from({ length: size }, () =>
      Array.from({ length: size }, () => alphabet[Math.floor(random() * alphabet.length)]),
    ),
    placements: [],
    stats: analyzeWordSearchPlacements([]),
    quality: false,
  };
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
