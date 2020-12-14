const axios = require('axios');
const farmRequest = require('./request');
const oauth = require('./oauth');

// Temporary stub until farmData is ready to use.
const getTypesStub = entity => ({
  log: ['activity', 'observation', 'input', 'harvest'],
  asset: ['animal', 'plant', 'equipment', 'sensor'],
})[entity];

function connect(host, opts) {
  const {
    getTypes = getTypesStub,
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
  const { request, makeGet } = farmRequest(client);

  const farm = {
    authorize,
    revokeTokens,
    getToken,
    area: {
      delete() {
        // TODO
      },
      geojson() {
        return request('/farm/areas/geojson/');
      },
      get() {
        // TODO
      },
      send() {
        // TODO
      },
    },
    asset: {
      delete(id) {
        return request(`/farm_asset/${id}.json`, { method: 'DELETE' });
      },
      get: makeGet('asset', getTypes),
      send(payload, id) {
        return request(`/farm_asset/${id}.json`, { method: 'POST', payload });
      },
    },
    info() {
      // Returns a json with {name: , url: , user: {uid: , name: , mail: }}
      return request('/farm.json');
    },
    log: {
      delete(id) {
        return request(`/log/${id}.json`, { method: 'DELETE' });
      },
      get: makeGet('log', getTypes),
      send(payload) {
        if (payload.id) {
          return request(`/log/${payload.id}`, { method: 'PUT', payload })
            // Add properties back to response so it mirrors a POST response
            .then(res => ({
              ...res,
              id: payload.id,
              uri: `${host}/log/${payload.id}`,
              resource: 'log',
            }));
        }
        return request('/log', { method: 'POST', payload });
      },
    },
    term: {
      get() {
        // TODO
      },
      send(payload) {
        if (payload.tid) {
          return request(`/taxonomy_term/${payload.tid}`, { method: 'PUT', payload });
        }
        return request('/taxonomy_term', { method: 'POST', payload });
      },
    },
    vocabulary(machineName) {
      if (machineName === undefined) {
        return request('/taxonomy_vocabulary.json');
      }
      return request(`/taxonomy_vocabulary.json?machine_name=${machineName}`);
    },
  };
  return farm;
}

module.exports = connect;
