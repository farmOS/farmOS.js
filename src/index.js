const { omit } = require('ramda');
const d9JsonApiAdapter = require('./connect/adapter');
const model = require('./model');
const { entities, entityMethods } = require('./entities');

const shortNames = entities.map(e => e.shortName);

function farmOS(config) {
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
      serialize: farm[shortName].serialize,
      deserialize: farm[shortName].deserialize,
      merge: farm[shortName].merge,
      fetch: connection[shortName].fetch,
      send: connection[shortName].send,
      delete: connection[shortName].delete,
    })),
  };
}

module.exports = farmOS;
