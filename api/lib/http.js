'use strict';

function json(context, status, body) {
  context.res = {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body,
  };
}

function handleError(context, error) {
  const status = error.status || 500;
  const message =
    status === 503
      ? 'Scripture API is not configured'
      : status === 400
        ? error.message || 'Bad request'
        : 'Scripture request failed';
  json(context, status, { error: message });
}

module.exports = {
  json,
  handleError,
};
