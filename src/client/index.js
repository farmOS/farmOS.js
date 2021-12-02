import axios from 'axios';
import deleteEntity from './delete.js';
import fetchEntity from './fetch.js';
import sendEntity from './send.js';
import oauth from './oauth.js';
import entities, { entityMethods } from '../entities.js';
import fetchSchema from './schema.js';

/** The methods for transmitting farmOS data structures, such as assets, logs,
 * etc, to a farmOS server.
 * @typedef {Object} ClientEntityMethods
 * @property {import('./fetch.js').fetchEntity} fetch
 * @property {import('./send.js').sendEntity} send
 * @property {import('./delete.js').deleteEntity} delete
 */

/** A collection of functions for transmitting farmOS data structures to and
 * from a farmOS Drupal 9 server using JSON:API.
 * @typedef {Object} FarmClient
 * @property {Function} authorize
 * @property {Function} setHost
 * @property {Function} getToken
 * @property {import('axios').AxiosInstance} request
 * @property {Function} info
 * @property {Object} schema
 * @property {Function} schema.fetch
 * @property {ClientEntityMethods} asset
 * @property {ClientEntityMethods} log
 * @property {ClientEntityMethods} plan
 * @property {ClientEntityMethods} quantity
 * @property {ClientEntityMethods} term
 * @property {ClientEntityMethods} user
 */

/**
 * Create a farm client for interacting with farmOS servers.
 * @typedef {Function} client
 * @param {String} host
 * @param {Object} options
 * @property {String} options.clientId
 * @property {Function} options.getToken
 * @property {Function} options.setToken
 * @returns {FarmClient}
 */
export default function client(host, options) {
  const {
    clientId,
    getToken: getTokenOpt,
    setToken,
  } = options;

  // Instantiate axios client.
  const clientOptions = {
    baseURL: host,
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    },
  };
  const request = axios.create(clientOptions);

  // Create oAuth & request helpers.
  const oAuthOpts = {
    host,
    clientId,
    getToken: getTokenOpt,
    setToken,
  };
  const {
    authorize, setHost, getToken,
  } = oauth(request, oAuthOpts);

  const farm = {
    authorize,
    setHost,
    getToken,
    request,
    info() {
      return request('/api');
    },
    schema: {
      fetch: fetchSchema(request),
    },
    ...entityMethods(({ nomenclature: { name } }) => ({
      delete: deleteEntity(name, request),
      fetch: fetchEntity(name, request),
      send: sendEntity(name, request),
    }), entities),
  };
  return farm;
}
