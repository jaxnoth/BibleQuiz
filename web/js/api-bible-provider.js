/**
 * ApiBibleProvider - translation-agnostic client for /api/scripture/* proxy.
 * Passes through proxy metadata. Does not call FUMS (session owns tracking).
 * Do not put API.Bible keys in this module.
 */

/**
 * @param {{ baseUrl?: string, fetchImpl?: typeof fetch }} [options]
 */
export function createApiBibleProvider(options = {}) {
  const baseUrl = (options.baseUrl || '/api/scripture').replace(/\/$/, '');
  const fetchImpl = options.fetchImpl || globalThis.fetch.bind(globalThis);
  const chapterCache = new Map();

  async function getJson(path) {
    const response = await fetchImpl(`${baseUrl}${path}`);
    if (!response.ok) {
      const err = new Error(`Scripture API ${response.status}`);
      err.status = response.status;
      throw err;
    }
    return response.json();
  }

  return {
    async getMetadata() {
      return getJson('/metadata');
    },

    async listChapters(book) {
      const payload = await getJson(`/chapters?book=${encodeURIComponent(book)}`);
      return Array.isArray(payload.chapters) ? payload.chapters : [];
    },

    async getChapter(book, chapterNumber) {
      const key = `${book}:${chapterNumber}`;
      if (chapterCache.has(key)) return chapterCache.get(key);

      try {
        const payload = await getJson(
          `/chapter?book=${encodeURIComponent(book)}&chapter=${encodeURIComponent(chapterNumber)}`,
        );
        if (!payload || !Array.isArray(payload.verses)) return null;
        const record = {
          book: payload.book,
          chapter: Number(payload.chapter),
          verses: payload.verses,
          metadata: payload.metadata,
          fumsToken: payload.fumsToken || null,
        };
        chapterCache.set(key, record);
        return record;
      } catch (error) {
        if (error.status === 404) return null;
        throw error;
      }
    },

    async search(query, { book, chapter } = {}) {
      const trimmed = String(query ?? '').trim();
      if (!trimmed) return [];

      const params = new URLSearchParams({ q: trimmed });
      if (book != null && book !== '' && book !== 'all') params.set('book', book);
      if (chapter != null && chapter !== '' && chapter !== 'all') params.set('chapter', String(chapter));

      const payload = await getJson(`/search?${params.toString()}`);
      const results = Array.isArray(payload.results) ? payload.results : [];
      return {
        results: results.map((row) => ({
          book: row.book,
          chapter: row.chapter,
          verse: row.verse,
          reference: row.reference,
          snippet: row.snippet,
        })),
        fumsToken: payload.fumsToken || null,
      };
    },
  };
}

/**
 * Probe whether the Scripture proxy is available.
 * @param {{ baseUrl?: string, fetchImpl?: typeof fetch }} [options]
 */
export async function probeApiBibleProvider(options = {}) {
  const baseUrl = (options.baseUrl || '/api/scripture').replace(/\/$/, '');
  const fetchImpl = options.fetchImpl || globalThis.fetch.bind(globalThis);
  try {
    const response = await fetchImpl(`${baseUrl}/metadata`);
    if (!response.ok) return null;
    const metadata = await response.json();
    if (!metadata || metadata.provider !== 'api.bible') return null;
    return metadata;
  } catch {
    return null;
  }
}
