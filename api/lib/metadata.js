'use strict';

const { policyForBible } = require('./translation-policy');

function buildApiMetadata(bibleInfo = {}, policyOverride = null) {
  const abbreviation = bibleInfo.abbreviation || bibleInfo.abbr || '';
  const name = bibleInfo.name || bibleInfo.nameLocal || abbreviation || 'Bible';
  const bibleId = bibleInfo.id || bibleInfo.bibleId || process.env.API_BIBLE_BIBLE_ID || '';
  const policy = policyOverride || policyForBible({ abbreviation, bibleId });
  const copyright = bibleInfo.copyright || '';
  const copyrightHtml = bibleInfo.copyrightHtml || copyright;

  return {
    provider: 'api.bible',
    source: 'api.bible',
    translation: name,
    abbreviation: abbreviation || name,
    copyright,
    copyrightHtml,
    scriptureAttribution: copyright || copyrightHtml || '',
    distribution: 'internal-team',
    ipHolder: policy.ipHolder || '',
    ipHolderUrl: policy.ipHolderUrl || '',
    providerUrl: 'https://api.bible',
    requiresBiblicaLink: Boolean(policy.requiresBiblicaLink),
    capabilities: {
      search: true,
      offline: false,
      apiBible: true,
      fumRequired: true,
      aiUseAllowed: false,
      textToSpeechAllowed: false,
    },
    limits: { ...policy.limits },
  };
}

module.exports = {
  buildApiMetadata,
};
