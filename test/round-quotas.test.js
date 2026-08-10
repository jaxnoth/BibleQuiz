import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROUND_SIZE,
  selectRoundQuestions,
  typeHistogram,
} from '../web/js/round-quotas.js';

function makePool(counts) {
  const pool = [];
  for (const [typeCode, count] of Object.entries(counts)) {
    for (let index = 0; index < count; index += 1) {
      pool.push({ id: `${typeCode}-${index}`, typeCode });
    }
  }
  return pool;
}

const fixedRandom = () => 0;

test('full supply with empty V/R backfills to G13 A4 Q1 S1 X1', () => {
  const pool = makePool({ G: 20, A: 8, Q: 3, S: 3, X: 3 });
  const selected = selectRoundQuestions(pool, null, { shuffle: false, random: fixedRandom });
  assert.equal(selected.length, ROUND_SIZE);
  assert.deepEqual(typeHistogram(selected), { G: 13, A: 4, Q: 1, S: 1, X: 1 });
});

test('when G cannot cover V/R shortfall A fills remainder', () => {
  const pool = makePool({ G: 11, A: 10, Q: 2, S: 2, X: 2 });
  const selected = selectRoundQuestions(pool, null, { shuffle: false, random: fixedRandom });
  assert.equal(selected.length, ROUND_SIZE);
  const histogram = typeHistogram(selected);
  assert.equal(histogram.G, 11);
  assert.equal(histogram.A, 6);
  assert.equal(histogram.Q, 1);
  assert.equal(histogram.S, 1);
  assert.equal(histogram.X, 1);
});

test('returns available questions when pool is smaller than 20', () => {
  const pool = makePool({ G: 5, A: 2, Q: 1, S: 1, X: 1 });
  const selected = selectRoundQuestions(pool, null, { shuffle: false, random: fixedRandom });
  assert.equal(selected.length, 10);
  assert.deepEqual(typeHistogram(selected), { G: 5, A: 2, Q: 1, S: 1, X: 1 });
});

test('single-type filter bypass uses plain slice outside quota helper', () => {
  const pool = makePool({ G: 30 });
  const selected = selectRoundQuestions(pool, null, { shuffle: false, random: fixedRandom });
  assert.equal(selected.length, ROUND_SIZE);
  assert.deepEqual(typeHistogram(selected), { G: 20 });
});
