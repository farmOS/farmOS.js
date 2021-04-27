const axios = require('axios');
const farmRequest = require('./request');
const oauth = require('./oauth');
const typeToBundle = require('./typeToBundle');
const { entities, entityMethods, emptySchemata } = require('../entities');


function connect(host, opts) {
  const {
    getTypes,
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
    request, deleteEntity, fetchEntity, sendEntity,
  } = farmRequest(client);

  const farm = {
    authorize,
    revokeTokens,
    getToken,
    request,
    info() {
      return request('api');
    },
    schema: {
      fetch(entity, bundle) {
        if (!entity) {
          const schemata = emptySchemata(entities);
          return request('api/')
            .then(res => Promise.all(Object.keys(res.links)
              .filter(type => entities.some(({ name }) => type.startsWith(`${name}--`)))
              .map((type) => {
                const [entName, b] = type.split('--');
                return request(`api/${entName}/${b}/resource/schema`)
                  .then((schema) => { schemata[entName][b] = schema; });
              })))
            .then(() => schemata);
        }
        if (!bundle) {
          return request('api/')
            .then(res => Promise.all(Object.keys(res.links)
              .filter(type => type.startsWith(`${entity}--`))
              .map((type) => {
                const b = typeToBundle(entity, type);
                return request(`api/${entity}/${b}/resource/schema`)
                  .then(schema => [b, schema]);
              }))
              .then(Object.fromEntries));
        }
        return request(`api/${entity}/${bundle}/resource/schema`);
      },
    },
    ...entityMethods(entities, ({ name }) => ({
      delete: deleteEntity(name),
      fetch: fetchEntity(name, getTypes),
      send: sendEntity(name),
    })),
  };
  return farm;
}

module.exports = connect;
