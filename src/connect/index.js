const axios = require('axios');
const {
  compose, defaultTo, prop, map,
} = require('ramda');
const farmRequest = require('./request');
const parseFilter = require('./parseFilter');
const oauth = require('./oauth');

function connect(host, oAuthOpts) {
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
  const { authorize, getToken, revokeTokens } = oauth(client, { ...oAuthOpts, host });
  const { request, requestAll, batchRequest } = farmRequest(client);

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
      get(opts = {}) {
        // If an ID # is passed instead of an options object
        if (typeof opts === 'number') {
          return request(`/farm_asset/${opts}.json`);
        }

        // If an option object is passed, set defaults and parse the string params
        const {
          type = '',
          archived = false,
          page = null,
        } = opts;
        const typeParams = (type !== '') ? `type=${type}` : '';
        const archiveParams = (archived) ? '' : '&archived=0';
        const pageParams = (page !== null) ? `&page=${page}` : '';

        // If no page # is passed, get all of them
        if (page === null) {
          return requestAll(`/farm_asset.json?${typeParams}${archiveParams}`);
        }

        // If no ID is passed but page is passed
        return request(`/farm_asset.json?${typeParams}${archiveParams}${pageParams}`);
      },
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
      get: compose(
        batchRequest,
        map(([bundle, params]) => `api/log/${bundle}?${params}`),
        Object.entries,
        parseFilter,
        prop('filter'),
        defaultTo({}),
      ),
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
