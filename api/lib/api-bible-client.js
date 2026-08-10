'use strict';

const BASE = 'https://api.scripture.api.bible/v1';

let bibleMetadataCache = null;
let bibleMetadataCachedAt = 0;
const BIBLE_META_TTL_MS = 15 * 60 * 1000;

function getConfig() {
  const apiKey = process.env.API_BIBLE_KEY;
  const bibleId = process.env.API_BIBLE_BIBLE_ID;
  if (!apiKey || !bibleId || apiKey.includes('replace-with') || bibleId.includes('replace-with')) {
    const err = new Error('API.Bible is not configured');
    err.status = 503;
    throw err;
  }
  return { apiKey, bibleId };
}

async function apiBibleFetch(path, { searchParams } = {}) {
  const { apiKey, bibleId } = getConfig();
  const url = new URL(`${BASE}${path.replace('{bibleId}', bibleId)}`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value != null && value !== '') url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url, {
    headers: {
      'api-key': apiKey,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const err = new Error('Upstream Scripture request failed');
    err.status = response.status >= 500 ? 502 : response.status;
    throw err;
  }

  return response.json();
}

async function getBibleMetadata() {
  const now = Date.now();
  if (bibleMetadataCache && now - bibleMetadataCachedAt < BIBLE_META_TTL_MS) {
    return bibleMetadataCache;
  }
  const payload = await apiBibleFetch('/bibles/{bibleId}');
  bibleMetadataCache = payload.data || {};
  bibleMetadataCachedAt = now;
  return bibleMetadataCache;
}

function extractFumsToken(payload) {
  return payload?.meta?.fumsToken || null;
}

module.exports = {
  getConfig,
  apiBibleFetch,
  getBibleMetadata,
  extractFumsToken,
};
