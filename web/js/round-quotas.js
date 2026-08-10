import { shuffle } from './game-engine.js';

/** Target counts for a 20-question all-types round (sheet contract). */
export const ROUND_TYPE_QUOTAS = [
  { key: 'G', count: 11 },
  { key: 'A', count: 4 },
  { key: 'Q', count: 1 },
  { key: 'V', count: 1 },
  { key: 'R', count: 1 },
  { key: 'S', count: 1 },
  { key: 'X', count: 1 },
];

export const ROUND_SIZE = 20;

export function typeHistogram(questions) {
  const counts = {};
  for (const question of questions) {
    const code = question.typeCode ?? '?';
    counts[code] = (counts[code] ?? 0) + 1;
  }
  return counts;
}

/**
 * Select a 20-question round by type quotas.
 * Empty V/R (and other short buckets) backfill from G, then A.
 * @param {object[]} pool
 * @param {object|null} profile
 * @param {{ shuffle?: boolean, random?: () => number, adaptiveShuffleFn?: Function }} options
 */
export function selectRoundQuestions(
  pool,
  profile,
  { shuffle: shouldShuffle = true, random = Math.random, adaptiveShuffleFn = null } = {},
) {
  const buckets = new Map();
  for (const question of pool) {
    const code = question.typeCode;
    if (!buckets.has(code)) buckets.set(code, []);
    buckets.get(code).push(question);
  }

  const orderBucket = (items) => {
    if (!items.length) return [];
    if (!shouldShuffle) return [...items];
    if (typeof adaptiveShuffleFn === 'function' && profile) {
      return adaptiveShuffleFn(items, 'questions', profile, random);
    }
    return shuffle(items, random);
  };

  const orderedBuckets = new Map();
  for (const [code, items] of buckets) {
    orderedBuckets.set(code, orderBucket(items));
  }

  const selected = [];
  const used = new Set();

  const takeFrom = (key, count) => {
    const bucket = orderedBuckets.get(key) ?? [];
    let taken = 0;
    for (const item of bucket) {
      if (taken >= count) break;
      if (used.has(item.id)) continue;
      selected.push(item);
      used.add(item.id);
      taken += 1;
    }
    return taken;
  };

  for (const { key, count } of ROUND_TYPE_QUOTAS) {
    takeFrom(key, count);
  }

  for (const key of ['G', 'A']) {
    if (selected.length >= ROUND_SIZE) break;
    takeFrom(key, ROUND_SIZE - selected.length);
  }

  if (selected.length < ROUND_SIZE) {
    const remainder = shouldShuffle ? shuffle([...pool], random) : [...pool];
    for (const item of remainder) {
      if (selected.length >= ROUND_SIZE) break;
      if (used.has(item.id)) continue;
      selected.push(item);
      used.add(item.id);
    }
  }

  return shouldShuffle ? shuffle(selected, random) : selected;
}
