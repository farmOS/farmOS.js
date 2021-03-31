const axios = require('axios');
const farmRequest = require('./request');
const oauth = require('./oauth');
const { typeToBundle } = require('../utils');

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
      return request('api');
    },
    asset: {
      delete: makeDelete('asset'),
      geojson() {
        // TODO
      },
      get: makeGet('asset', getTypes),
      send: makeSend('asset', validate),
    },
    log: {
      delete: makeDelete('log'),
      get: makeGet('log', getTypes),
      send: makeSend('log', validate),
    },
    schema: {
      get(entity, bundle) {
        if (!entity) {
          throw new Error('A valid entity must be provided to fetch a schema.');
        }
        if (bundle) {
          return request(`api/${entity}/${bundle}/resource/schema`);
        }
        return request('api/')
          .then(res => Promise.all(Object.keys(res.links)
            .filter(key => key.startsWith(`${entity}--`))
            .map((type) => {
              const b = typeToBundle(entity, type);
              return request(`api/${entity}/${b}/resource/schema`)
                .then(schema => [b, schema]);
            }))
            .then(Object.fromEntries));
      },
    },
    term: {
      delete: makeDelete('taxonomy_term'),
      get: makeGet('taxonomy_term', getTypes),
      send: makeSend('taxonomy_term', validate),
    },
    user(uuid) {
      if (typeof uuid === 'string') {
        return request(`api/user/user/${uuid}`);
      }
      return request('api/user/user');
    },
    quantity: {
      delete: makeDelete('quantity'),
      get: makeGet('quantity', getTypes),
      send: makeSend('quantity', validate),
    },
  };
  return farm;
}

module.exports = connect;
