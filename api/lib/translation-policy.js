'use strict';

/**
 * Server-side translation policy keyed by bible id and/or abbreviation.
 * Client providers must not hardcode these values.
 */

const BY_ABBREVIATION = {
  NIV: {
    ipHolder: 'Biblica',
    ipHolderUrl: 'https://www.biblica.com',
    requiresBiblicaLink: true,
    limits: {
      maxVisibleChapters: 2,
      maxVisibleVerses: 25,
      requiresAttributionLink: true,
      requiresIpHolderLinkPerDisplay: true,
      requiresThirtyDayRefresh: false,
      requiresSecureKeyHandling: true,
    },
  },
};

const DEFAULT_POLICY = {
  ipHolder: '',
  ipHolderUrl: '',
  requiresBiblicaLink: false,
  limits: {
    maxVisibleChapters: null,
    maxVisibleVerses: null,
    requiresAttributionLink: true,
    requiresIpHolderLinkPerDisplay: false,
    requiresThirtyDayRefresh: false,
    requiresSecureKeyHandling: true,
  },
};

function policyForBible({ abbreviation, bibleId } = {}) {
  const abbr = String(abbreviation || '')
    .trim()
    .toUpperCase();
  if (abbr && BY_ABBREVIATION[abbr]) {
    return { ...BY_ABBREVIATION[abbr], limits: { ...BY_ABBREVIATION[abbr].limits } };
  }
  // NIV11 and similar Biblica NIV edition abbreviations
  if (abbr.startsWith('NIV') && BY_ABBREVIATION.NIV) {
    return { ...BY_ABBREVIATION.NIV, limits: { ...BY_ABBREVIATION.NIV.limits } };
  }
  const id = String(bibleId || '').trim();
  if (id === '78a9f6124f344018-01' && BY_ABBREVIATION.NIV) {
    return { ...BY_ABBREVIATION.NIV, limits: { ...BY_ABBREVIATION.NIV.limits } };
  }
  return { ...DEFAULT_POLICY, limits: { ...DEFAULT_POLICY.limits } };
}

module.exports = {
  policyForBible,
  BY_ABBREVIATION,
  DEFAULT_POLICY,
};
