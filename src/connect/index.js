const axios = require('axios');
const farmRequest = require('./request');
const oauth = require('./oauth');

function connect(host, opts) {
  const {
    getTypes,
    validate,
    clientId,
    getToken: getTokenOpt,
    setToken,
  } = opts;

  // Instantiate axios client.
  const clientOptions = {
    baseURL: host,
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    },
  };
  const client = axios.create(clientOptions);

  // Create oAuth & request helpers.
  const oAuthOpts = {
    host,
    clientId,
    getToken: getTokenOpt,
    setToken,
  };
  const { authorize, getToken, revokeTokens } = oauth(client, oAuthOpts);
  const {
    request, makeGet, makeSend, makeDelete,
  } = farmRequest(client);

  const farm = {
    authorize,
    revokeTokens,
    getToken,
    request,
    info() {
      // TODO
    },
    area: {
      delete() {
        // TODO
      },
      geojson() {
        // TODO
      },
      get() {
        // TODO
      },
      send() {
        // TODO
      },
    },
    asset: {
      delete: makeDelete('asset'),
      get: makeGet('asset', getTypes),
      send: makeSend('asset', validate),
    },
    log: {
      delete: makeDelete('log'),
      get: makeGet('log', getTypes),
      send: makeSend('log', validate),
    },
    term: {
      delete: makeDelete('taxonomy_term'),
      get: makeGet('taxonomy_term', getTypes),
      send: makeSend('taxonomy_term', validate),
    },
    vocabulary() {
      // TODO
    },
  };
  return farm;
}

module.exports = connect;
