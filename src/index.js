import omit from 'ramda/src/omit.js';
import d9JsonApiAdapter from './connect/adapter.js';
import model from './model/index.js';
import { entities, entityMethods } from './entities.js';

const shortNames = entities.map(e => e.shortName);

export default function farmOS(config) {
  const {
    schemata = {},
    remote: {
      adapter = d9JsonApiAdapter,
      options = {},
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
    ...entityMethods(entities, ({ shortName }) => ({
      create: farm[shortName].create,
      update: farm[shortName].update,
      merge: farm[shortName].merge,
      fetch: connection[shortName].fetch,
      send: connection[shortName].send,
      delete: connection[shortName].delete,
    })),
  };
}
