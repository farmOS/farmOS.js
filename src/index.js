import omit from 'ramda/src/omit.js';
import d9JsonApiAdapter from './client/adapter/index.js';
import model from './model/index.js';
import defaultEntities from './entities.js';

export { default as entities } from './entities.js';
export { default as client } from './client/index.js';
export { parseBundles } from './client/adapter/index.js';
export { default as model } from './model/index.js';

/** The methods for writing to local copies of farmOS data structures, such as
 * assets, logs, etc, and for transmitting those entities to a farmOS server.
 * @typedef {Object} FarmEntityMethods
 * @property {import('./model/create.js').createEntity} create
 * @property {import('./model/update.js').updateEntity} update
 * @property {import('./model/merge.js').mergeEntity} merge
 * @property {import('./client/fetch.js').fetchEntity} [fetch]
 * @property {import('./client/send.js').sendEntity} [send]
 * @property {import('./client/delete.js').deleteEntity} [delete]
 */

/** A collection of functions for working with farmOS data structures, their
 * associated metadata and schemata, and for interacting with farmOS servers.
 * @typedef {Object} FarmObject
 * @property {Object} schema
 * @property {Function} schema.get
 * @property {Function} schema.set
 * @property {Function} schema.on
 * @property {Function} [schema.fetch]
 * @property {Object} meta
 * @property {Function} meta.isUnsynced
 * @property {Object} remote
 * @property {import('axios').AxiosInstance} remote.request
 * @property {Function} [remote.info]
 * @property {Function} [remote.authorize]
 * @property {Function} [remote.getToken]
 * @property {FarmEntityMethods} asset
 * @property {FarmEntityMethods} log
 * @property {FarmEntityMethods} plan
 * @property {FarmEntityMethods} quantity
 * @property {FarmEntityMethods} term
 * @property {FarmEntityMethods} user
 */

/**
 * To enable support for each entity type, its config object must be provided.
 * @typedef {import('./entities.js').EntityConfig} EntityConfig
 */

/** The main farmOS factory function for creating a new farm object.
 * @typedef {Function} farmOS
 * @param {Object} farmConfig
 * @property {import('./model/index.js').EntitySchemata} [config.schemata]
 * @property {Object} [config.remote]
 * @property {import('./client/index.js').client} [config.remote.adapter=d9JsonApiAdapter]
 * @property {Object.<String, EntityConfig>} [config.entities=defaultEntities]
 * @returns {FarmObject}
 */
export default function farmOS(farmConfig) {
  const { schemata, remote, entities = defaultEntities } = farmConfig;
  const shortNames = Object.values(entities).map(e => e.nomenclature.shortName);

  const farm = /** @type {FarmObject} */ (model({ schemata, entities }));

  const addRemote = (remoteConfig = {}) => {
    const { adapter = d9JsonApiAdapter, ...options } = remoteConfig;
    const connection = adapter(farm, options);
    farm.schema.fetch = connection.schema.fetch;
    shortNames.forEach((shortName) => {
      farm[shortName].fetch = connection[shortName].fetch;
      farm[shortName].send = connection[shortName].send;
      farm[shortName].delete = connection[shortName].delete;
    });
    farm.remote = { ...omit(shortNames, connection), add: addRemote };
  };
  addRemote({ ...remote, entities });

  return farm;
}
