/**
 * ScriptureProvider contract (async, duck-typed):
 *   getMetadata() -> Promise<ScriptureProviderMetadata>
 *   listChapters(book) -> Promise<number[]>
 *   getChapter(book, chapter, options?) -> Promise<ScriptureChapter | null>
 *   search(query, options?) -> Promise<ScriptureSearchResult[]>
 *
 * LocalScriptureProvider is the current provider for bundled study-data Scripture.
 * Future API.Bible support must implement the same contract through a secure backend/proxy.
 * Do not expose API.Bible credentials in browser JavaScript.
 * Do not have UI code depend on LocalScriptureProvider internals.
 *
 * Local provider currently uses scripture-concordance.js as its search engine.
 * Future providers may implement search natively.
 * Consumers: UI -> scripture-session -> provider. Never UI -> concordance -> provider.
 *
 * Future ApiBibleProvider is implemented in api-bible-provider.js (proxy only).
 * Policy limits and IP-holder fields come from proxy metadata, not client hardcodes.
 */

import { searchScripture } from './scripture-concordance.js';

/**
 * @typedef {Object} ScriptureProviderMetadata
 * @property {string} provider
 * @property {string} source
 * @property {string} translation
 * @property {string} abbreviation
 * @property {string} scriptureAttribution
 * @property {string} copyright
 * @property {string} copyrightHtml
 * @property {string} ipHolder
 * @property {string} ipHolderUrl
 * @property {string} providerUrl
 * @property {string} distribution
 * @property {Object} capabilities
 * @property {Object} limits
 */

/**
 * @typedef {Object} ScriptureChapter
 * @property {string} book
 * @property {number} chapter
 * @property {{ verse: number, text: string, reference: string }[]} verses
 * @property {ScriptureProviderMetadata} metadata
 */

/**
 * @typedef {Object} ScriptureSearchResult
 * @property {string} book
 * @property {number} chapter
 * @property {number} verse
 * @property {string} reference
 * @property {string} snippet
 */

function normalizeBook(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('en-US');
}

function booksMatch(left, right) {
  return normalizeBook(left) === normalizeBook(right);
}

function buildLocalMetadata(meta) {
  return {
    provider: 'local',
    source: meta.source || 'bundled-study-data',
    translation: meta.translation || 'NIV',
    abbreviation: meta.abbreviation || meta.translation || 'NIV',
    scriptureAttribution: meta.scriptureAttribution || '',
    copyright: meta.copyright || '',
    copyrightHtml: meta.copyrightHtml || '',
    ipHolder: meta.ipHolder || '',
    ipHolderUrl: meta.ipHolderUrl || '',
    providerUrl: meta.providerUrl || '',
    distribution: meta.distribution || 'internal-team',
    requiresBiblicaLink: Boolean(meta.requiresBiblicaLink),
    capabilities: {
      search: true,
      offline: true,
      apiBible: false,
      fumRequired: false,
      aiUseAllowed: false,
      textToSpeechAllowed: false,
    },
    limits: {
      maxVisibleChapters: null,
      maxVisibleVerses: null,
      requiresAttributionLink: false,
      requiresIpHolderLinkPerDisplay: false,
      requiresThirtyDayRefresh: false,
      requiresSecureKeyHandling: false,
    },
  };
}

/**
 * Create a LocalScriptureProvider over bundled study-data Scripture chapters.
 * @param {object} studyData
 */
export function createLocalScriptureProvider(studyData) {
  const chapters = studyData?.scriptureChapters ?? [];
  const meta = studyData?.metadata ?? {};

  return {
    async getMetadata() {
      return buildLocalMetadata(meta);
    },

    async listChapters(book) {
      return chapters
        .filter((chapter) => booksMatch(chapter.book, book))
        .map((chapter) => Number(chapter.chapter))
        .sort((a, b) => a - b);
    },

    async getChapter(book, chapterNumber) {
      const match = chapters.find(
        (chapter) =>
          booksMatch(chapter.book, book) && Number(chapter.chapter) === Number(chapterNumber),
      );
      if (!match) return null;
      const metadata = buildLocalMetadata(meta);
      return {
        book: match.book,
        chapter: match.chapter,
        verses: match.verses ?? [],
        metadata,
      };
    },

    async search(query, { book, chapter } = {}) {
      if (book != null && book !== '' && book !== 'all') {
        const available = chapters.some((entry) => booksMatch(entry.book, book));
        if (!available) return [];
      }

      const scoped =
        book != null && book !== '' && book !== 'all'
          ? chapters.filter((entry) => booksMatch(entry.book, book))
          : chapters;

      const hits = searchScripture(scoped, query, { chapterFilter: chapter });
      return hits.map((hit) => ({
        book: hit.book ?? book ?? scoped[0]?.book ?? 'John',
        chapter: hit.chapter,
        verse: hit.verse,
        reference: hit.reference,
        snippet: hit.snippet,
      }));
    },
  };
}
