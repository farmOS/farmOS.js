import omit from 'ramda/src/omit.js';
import d9JsonApiAdapter from './client/adapter/index.js';
import model from './model/index.js';
import entities, { entityMethods } from './entities.js';

export { default as entities } from './entities.js';
export { default as client } from './client/index.js';
export { default as model } from './model/index.js';

const shortNames = Object.values(entities).map(e => e.shortName);

/** The methods for writing to local copies of farmOS data structures, such as
 * assets, logs, etc, and for transmitting those entities to a farmOS server.
 * @typedef {Object} FarmEntityMethods
 * @property {import('./model/create.js').createEntity} create
 * @property {import('./model/update.js').updateEntity} update
 * @property {import('./model/merge.js').mergeEntity} merge
 * @property {import('./client/fetch.js').fetchEntity} fetch
 * @property {import('./client/send.js').sendEntity} send
 * @property {import('./client/delete.js').deleteEntity} delete
 */

/** A collection of functions for working with farmOS data structures, their
 * associated metadata and schemata, and for interacting with farmOS servers.
 * @typedef {Object} FarmObject
 * @property {Object} schema
 * @property {Function} schema.get
 * @property {Function} schema.set
 * @property {Function} schema.on
 * @property {Object} meta
 * @property {Function} meta.isUnsynced
 * @property {Object} remote
 * @property {import('axios').AxiosInstance} remote.request
 * @property {Function} remote.info
 * @property {Function} remote.authorize
 * @property {Function} remote.setHost
 * @property {Function} remote.getToken
 * @property {FarmEntityMethods} asset
 * @property {FarmEntityMethods} log
 * @property {FarmEntityMethods} plan
 * @property {FarmEntityMethods} quantity
 * @property {FarmEntityMethods} term
 * @property {FarmEntityMethods} user
 */

/** The main farmOS factory function for creating a new farm object.
 * @typedef {Function} farmOS
 * @param {Object} config
 * @property {import('./model/index.js').EntitySchemata} [config.schemata]
 * @property {Object} [config.remote]
 * @property {import('./client/index.js').FarmClient} [config.remote.adapter]
 * @returns {FarmObject}
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
