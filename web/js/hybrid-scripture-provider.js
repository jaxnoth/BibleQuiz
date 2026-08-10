/**
 * Prefer API.Bible for Scripture text/search (full book chapters), with Local
 * bundled chapters as offline fallback. Study-pack overlays stay on study-data.
 * Quiz enabledChapters remain separate and are not used for Scripture listing.
 */

import { createLocalScriptureProvider } from './scripture-provider.js';
import { createApiBibleProvider } from './api-bible-provider.js';

/**
 * @param {object} studyData
 * @param {{ apiBaseUrl?: string, fetchImpl?: typeof fetch }} [options]
 */
export function createHybridScriptureProvider(studyData, options = {}) {
  const local = createLocalScriptureProvider(studyData);
  const api = createApiBibleProvider({
    baseUrl: options.apiBaseUrl,
    fetchImpl: options.fetchImpl,
  });

  return {
    async getMetadata() {
      try {
        return await api.getMetadata();
      } catch {
        return local.getMetadata();
      }
    },

    async listChapters(book) {
      try {
        const chapters = await api.listChapters(book);
        if (Array.isArray(chapters) && chapters.length) return chapters;
      } catch {
        // fall through
      }
      return local.listChapters(book);
    },

    async getChapter(book, chapterNumber) {
      try {
        const chapter = await api.getChapter(book, chapterNumber);
        if (chapter?.verses?.length) return chapter;
      } catch {
        // fall through
      }
      return local.getChapter(book, chapterNumber);
    },

    async search(query, scope = {}) {
      try {
        const raw = await api.search(query, scope);
        if (Array.isArray(raw) && raw.length) return raw;
        if (raw?.results?.length) return raw;
        // Empty successful API search should win over Local (same query, different corpus).
        if (raw && Array.isArray(raw.results)) return raw;
      } catch {
        // fall through
      }
      return local.search(query, scope);
    },
  };
}
