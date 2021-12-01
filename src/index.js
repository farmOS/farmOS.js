import omit from 'ramda/src/omit.js';
import d9JsonApiAdapter from './client/adapter/index.js';
import model from './model/index.js';
import entities, { entityMethods } from './entities.js';

export { default as entities } from './entities.js';
export { default as client } from './client/index.js';
export { default as model } from './model/index.js';

const shortNames = Object.values(entities).map(e => e.shortName);

/**
 * @typedef {Object} FarmEntityMethods
 * @property {import('./model/create.js').CreateEntityMethod} create
 * @property {import('./model/update.js').UpdateEntityMethod} update
 * @property {import('./model/merge.js').MergeEntityMethod} merge
 * @property {import('./client/fetch.js').FetchEntityMethod} fetch
 * @property {import('./client/send.js').SendEntityMethod} send
 * @property {import('./client/delete.js').DeleteEntityMethod} delete
 */

/**
 * @typedef {Object} FarmRemote
 * @property {import('axios').AxiosInstance} request
 * @property {Function} info
 * @property {Function} authorize
 * @property {Function} setHost
 * @property {Function} getToken
 */

/**
 * @typedef {Object} FarmInstance
 * @property {Object} schema
 * @property {Function} schema.get
 * @property {Function} schema.set
 * @property {Function} schema.on
 * @property {Object} meta
 * @property {Function} meta.isUnsynced
 * @property {FarmRemote} remote
 * @property {FarmEntityMethods} asset
 * @property {FarmEntityMethods} log
 * @property {FarmEntityMethods} plan
 * @property {FarmEntityMethods} quantity
 * @property {FarmEntityMethods} term
 * @property {FarmEntityMethods} user
 */

/**
 * @typedef {Function} FarmOS
 * @param {Object} config
 * @property {import('./model/index.js').EntitySchemata} [config.schemata]
 * @property {Object} [config.remote]
 * @property {import('./client/index.js').FarmClient} [config.remote.adapter]
 * @returns {FarmInstance}
 */
export default function farmOS(config) {
  const {
    schemata = {},
    remote: {
      adapter = d9JsonApiAdapter,
      ...options
    } = {},
  } = config;

  const farm = model({ schemata });
  const connection = adapter(farm, options);

  return {
    schema: {
      ...farm.schema,
      fetch: connection.schema.fetch,
    },
    meta: farm.meta,
    remote: { ...omit(shortNames, connection) },
    ...entityMethods(({ nomenclature: { shortName } }) => ({
      create: farm[shortName].create,
      update: farm[shortName].update,
      merge: farm[shortName].merge,
      fetch: connection[shortName].fetch,
      send: connection[shortName].send,
      delete: connection[shortName].delete,
    }), entities),
  };
}
