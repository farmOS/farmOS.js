import axios from 'axios';
import map from 'ramda/src/map.js';
import prop from 'ramda/src/prop.js';
import deleteEntity from './delete.js';
import fetchEntity from './fetch.js';
import sendEntity from './send.js';
import oauth from './oauth.js';
import typeToBundle from './typeToBundle.js';
import entities, { entityMethods } from '../entities.js';

/**
 * @typedef {import('../json-schema/reference').JsonSchema} JsonSchema
 * @typedef {import('../model/index').EntitySchemata} EntitySchemata
 * @typedef {import('../model/index').BundleSchemata} BundleSchemata
 */
/**
 * @typedef {Object} ClientEntityMethods
 * @property {import('./fetch.js').FetchEntityMethod} fetch
 * @property {import('./send.js').SendEntityMethod} send
 * @property {import('./delete.js').DeleteEntityMethod} delete
 */
/**
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

const entityNames = Object.keys(entities);

/**
 * Create a farm client for transmitting farmOS data structures to and from a
 * farmOS Drupal 9 server using JSON:API.
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
      /**
       * Fetch JSON Schema documents for farmOS data structures.
       * @param {string} [entity] The farmOS entity for which you wish to retrieve schemata.
       * @param {string} [bundle] The entity bundle for which you wish to retrieve schemata.
       * @returns {Promise<EntitySchemata|BundleSchemata|JsonSchema>}
       */
      fetch(entity, bundle) {
        if (!entity) {
          const schemata = map(() => ({}), entities);
          return request('/api/')
            .then(res => Promise.all(Object.keys(res.data.links)
              .filter(type => entityNames.some(name => type.startsWith(`${name}--`)))
              .map((type) => {
                const [entName, b] = type.split('--');
                return request(`/api/${entName}/${b}/resource/schema`)
                  .then(({ data: schema }) => { schemata[entName][b] = schema; });
              })))
            .then(() => schemata);
        }
        if (!bundle) {
          return request('/api/')
            .then(res => Promise.all(Object.keys(res.data.links)
              .filter(type => type.startsWith(`${entity}--`))
              .map((type) => {
                const b = typeToBundle(entity, type);
                return request(`/api/${entity}/${b}/resource/schema`)
                  .then(({ data: schema }) => [b, schema]);
              }))
              .then(Object.fromEntries));
        }
        return request(`/api/${entity}/${bundle}/resource/schema`)
          .then(prop('data'));
      },
    },
    ...entityMethods(({ nomenclature: { name } }) => ({
      delete: deleteEntity(name, request),
      fetch: fetchEntity(name, request),
      send: sendEntity(name, request),
    }), entities),
  };
  return farm;
}
