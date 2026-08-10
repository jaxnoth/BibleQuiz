'use strict';

const { getBibleMetadata } = require('../lib/api-bible-client');
const { buildApiMetadata } = require('../lib/metadata');
const { json, handleError } = require('../lib/http');

module.exports = async function (context) {
  try {
    const bibleInfo = await getBibleMetadata();
    json(context, 200, buildApiMetadata(bibleInfo));
  } catch (error) {
    handleError(context, error);
  }
};
