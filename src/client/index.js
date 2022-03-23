import axios from 'axios';
import deleteEntity from './delete.js';
import fetchEntity from './fetch.js';
import sendEntity from './send.js';
import oauth from './oauth.js';
import defaultEntities, { entityMethods } from '../entities.js';
import fetchSchema from './schema.js';

/** The methods for transmitting farmOS data structures, such as assets, logs,
 * etc, to a farmOS server.
 * @typedef {Object} ClientEntityMethods
 * @property {import('./fetch.js').fetchEntity} fetch
 * @property {import('./send.js').sendEntity} send
 * @property {import('./delete.js').deleteEntity} delete
 */

/**
 * @typedef {Function} AuthMixin
 * @param {import('axios').AxiosInstance} request
 * @param {Object} authOptions
 * @property {String} authOptions.host
 * @returns {Object<string,function>}
 */

/** A collection of functions for transmitting farmOS data structures to and
 * from a farmOS Drupal 9 server using JSON:API.
 * @typedef {Object} FarmClient
 * @property {import('axios').AxiosInstance} request
 * @property {Function} [authorize]
 * @property {Function} [getToken]
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
 * @typedef {import('../entities.js').EntityConfig} EntityConfig
 */

/**
 * Create a farm client for interacting with farmOS servers.
 * @typedef {Function} client
 * @param {String} host
 * @param {Object} [options]
 * @property {AuthMixin=OAuthMixin} [options.auth=oauth]
 * @property {Object<String, EntityConfig>} [options.entities=defaultEntities]
 * @property {String} [options.clientId]
 * @property {Function} [options.getToken]
 * @property {Function} [options.setToken]
 * @returns {FarmClient}
 */
export default function client(host, options) {
  const {
    auth = oauth,
    entities = defaultEntities,
    ...authOptions
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

  const authMethods = auth(request, { host, ...authOptions }) || {};

  const farm = {
    ...authMethods,
    request,
    info() {
      return request('/api');
    },
    schema: {
      fetch: fetchSchema(request, entities),
    },
    ...entityMethods(({ nomenclature: { name } }) => ({
      delete: deleteEntity(name, request),
      fetch: fetchEntity(name, request),
      send: sendEntity(name, request),
    }), entities),
  };
  return farm;
}
