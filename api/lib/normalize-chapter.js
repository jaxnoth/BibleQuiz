'use strict';

/**
 * Parse API.Bible chapter content into { verse, text, reference }[] without
 * rewriting Scripture wording (structure only).
 */

function flattenText(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join('');
  if (typeof node === 'object') {
    if (typeof node.text === 'string') return node.text;
    if (Array.isArray(node.items)) return node.items.map(flattenText).join('');
    if (Array.isArray(node.content)) return node.content.map(flattenText).join('');
  }
  return '';
}

function collectJsonVerses(node, verses, bookName, chapterNumber) {
  if (node == null) return;
  if (Array.isArray(node)) {
    node.forEach((child) => collectJsonVerses(child, verses, bookName, chapterNumber));
    return;
  }
  if (typeof node !== 'object') return;

  const name = String(node.name || node.type || '').toLowerCase();
  if (name === 'verse' || node.number != null) {
    const verseNumber = Number(node.number ?? node.verse);
    if (Number.isFinite(verseNumber) && verseNumber > 0) {
      const text = flattenText(node.items ?? node.content ?? node.text).replace(/\s+/g, ' ').trim();
      if (text) {
        verses.push({
          verse: verseNumber,
          text,
          reference: `${bookName} ${chapterNumber}:${verseNumber}`,
        });
      }
      return;
    }
  }

  if (Array.isArray(node.items)) {
    collectJsonVerses(node.items, verses, bookName, chapterNumber);
  }
  if (Array.isArray(node.content)) {
    collectJsonVerses(node.content, verses, bookName, chapterNumber);
  }
}

function decodeEntities(value) {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripTags(html) {
  return decodeEntities(String(html).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function parseHtmlVerses(html, bookName, chapterNumber) {
  const verses = [];
  const source = String(html || '');
  const spanRe =
    /<span[^>]*data-number=["']?(\d+)["']?[^>]*>(?:<span[^>]*class=["']?v["']?[^>]*>\d+<\/span>)?([\s\S]*?)(?=<span[^>]*data-number=|$)/gi;
  let match;
  while ((match = spanRe.exec(source))) {
    const verse = Number(match[1]);
    const text = stripTags(match[2]);
    if (Number.isFinite(verse) && text) {
      verses.push({
        verse,
        text,
        reference: `${bookName} ${chapterNumber}:${verse}`,
      });
    }
  }
  if (verses.length) return verses;

  const plain = stripTags(source);
  const parts = plain.split(/(?=\b\d+\s)/);
  for (const part of parts) {
    const m = part.match(/^(\d+)\s+([\s\S]+)$/);
    if (!m) continue;
    const verse = Number(m[1]);
    const text = m[2].trim();
    if (Number.isFinite(verse) && text) {
      verses.push({
        verse,
        text,
        reference: `${bookName} ${chapterNumber}:${verse}`,
      });
    }
  }
  return verses;
}

function parseTextVerses(text, bookName, chapterNumber) {
  const verses = [];
  const lines = String(text || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^\[?(\d+)\]?\s+(.+)$/);
    if (!m) continue;
    const verse = Number(m[1]);
    const body = m[2].trim();
    if (Number.isFinite(verse) && body) {
      verses.push({
        verse,
        text: body,
        reference: `${bookName} ${chapterNumber}:${verse}`,
      });
    }
  }
  return verses;
}

/**
 * @param {*} content API.Bible chapter content (json object/array, html string, or text)
 * @param {{ book: string, chapter: number }} ctx
 */
function normalizeChapterContent(content, { book, chapter }) {
  const bookName = book || 'John';
  const chapterNumber = Number(chapter) || 1;
  const verses = [];

  if (content == null) return verses;

  if (typeof content === 'object') {
    collectJsonVerses(content, verses, bookName, chapterNumber);
    if (verses.length) {
      verses.sort((a, b) => a.verse - b.verse);
      return verses;
    }
  }

  if (typeof content === 'string') {
    if (/<[a-z][\s\S]*>/i.test(content)) {
      return parseHtmlVerses(content, bookName, chapterNumber);
    }
    return parseTextVerses(content, bookName, chapterNumber);
  }

  return verses;
}

module.exports = {
  normalizeChapterContent,
  flattenText,
  parseHtmlVerses,
  parseTextVerses,
};
