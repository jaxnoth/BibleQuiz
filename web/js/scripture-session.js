/**
 * UI-facing Scripture session: joins ScriptureProvider text/search/metadata
 * with study-pack overlays (memory verses, unique words).
 * Consumers: UI -> scripture-session -> provider. Do not call concordance from UI.
 *
 * FUMS: session owns view tracking when provider returns fumsToken.
 * Limits: validateVisibleContent / canRender surface provider.limits for future
 * compliance. V1 does not block the single-chapter reader.
 */

import { listUniqueWords as filterUniqueWords } from './scripture-concordance.js';

function defaultFumsReporter(token) {
  if (!token || typeof globalThis.fums !== 'function') return;
  try {
    globalThis.fums('trackView', token);
  } catch {
    // Tracker failures must not break Scripture UI.
  }
}

/**
 * @param {object} provider ScriptureProvider
 * @param {object} studyData study-data.json shape (overlays only for this facade)
 * @param {{ fumsReporter?: (token: string) => void }} [options]
 */
export function createScriptureSession(provider, studyData, options = {}) {
  const memoryVerses = studyData?.memoryVerses ?? [];
  const uniqueWords = studyData?.uniqueWords ?? [];
  const fumsReporter = options.fumsReporter || defaultFumsReporter;

  async function reportFums(token, metadata) {
    if (!token) return;
    const required = metadata?.capabilities?.fumRequired;
    if (required === false) return;
    fumsReporter(token);
  }

  return {
    listChapters(book) {
      return provider.listChapters(book);
    },

    getMetadata() {
      return provider.getMetadata();
    },

    /**
     * Future compliance helper. Does not block UI in V1.
     * @param {{ chapters?: number|number[], verses?: number|number[] }} visible
     */
    async validateVisibleContent(visible = {}) {
      const metadata = await provider.getMetadata();
      const limits = metadata.limits || {};
      const chapterList = Array.isArray(visible.chapters)
        ? visible.chapters
        : visible.chapters != null
          ? [visible.chapters]
          : [];
      const verseList = Array.isArray(visible.verses)
        ? visible.verses
        : visible.verses != null
          ? [visible.verses]
          : [];

      const maxChapters = limits.maxVisibleChapters;
      const maxVerses = limits.maxVisibleVerses;

      if (maxChapters == null && maxVerses == null) {
        return { ok: true, reason: null, limits };
      }

      const chapterCount = new Set(chapterList.map(Number)).size;
      const verseCount = verseList.length;

      // Biblica-style rule: allow up to maxChapters chapters OR maxVerses verses,
      // whichever is greater as an allowance - ok if either constraint is satisfied.
      if (maxChapters != null && maxVerses != null) {
        const chaptersOk = chapterCount <= maxChapters;
        const versesOk = verseCount <= maxVerses;
        if (chaptersOk || versesOk) {
          return { ok: true, reason: null, limits };
        }
        return {
          ok: false,
          reason: `Visible content exceeds limits (max ${maxChapters} chapters or ${maxVerses} verses)`,
          limits,
        };
      }

      if (maxChapters != null && chapterCount > maxChapters) {
        return {
          ok: false,
          reason: `Visible chapters ${chapterCount} exceed limit ${maxChapters}`,
          limits,
        };
      }

      if (maxVerses != null && verseCount > maxVerses) {
        return {
          ok: false,
          reason: `Visible verses ${verseCount} exceed limit ${maxVerses}`,
          limits,
        };
      }

      return { ok: true, reason: null, limits };
    },

    async canRender(visible) {
      const result = await this.validateVisibleContent(visible);
      return result.ok;
    },

    async getChapterView(book, chapter) {
      // V1: do not block on limits - single-chapter reader complies.
      // Future multi-pane UI should call validateVisibleContent before render.
      const record = await provider.getChapter(book, chapter);
      const metadata = record?.metadata ?? (await provider.getMetadata());
      const capabilities = metadata.capabilities ?? {};
      const limits = metadata.limits ?? {};

      if (record?.fumsToken) {
        await reportFums(record.fumsToken, metadata);
      }

      if (!record) {
        return {
          book,
          chapter: Number(chapter),
          verses: [],
          memoryVerses: [],
          uniqueWords: [],
          metadata,
          capabilities,
          limits,
        };
      }

      const chapterNumber = Number(record.chapter);
      return {
        book: record.book,
        chapter: chapterNumber,
        verses: record.verses,
        memoryVerses: memoryVerses.filter((verse) => Number(verse.chapter) === chapterNumber),
        uniqueWords: uniqueWords.filter((word) => Number(word.chapter) === chapterNumber),
        metadata,
        capabilities,
        limits,
      };
    },

    async search(query, { book, chapter } = {}) {
      const raw = await provider.search(query, { book, chapter });
      // Local provider returns an array; API provider may return { results, fumsToken }.
      if (Array.isArray(raw)) return raw;
      const metadata = await provider.getMetadata();
      if (raw?.fumsToken) await reportFums(raw.fumsToken, metadata);
      return Array.isArray(raw?.results) ? raw.results : [];
    },

    listUniqueWords({ chapter, query } = {}) {
      return Promise.resolve(
        filterUniqueWords(uniqueWords, {
          chapterFilter: chapter,
          query,
        }),
      );
    },
  };
}
