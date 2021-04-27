const {
  compose, dissoc, evolve, omit, mapObjIndexed, map, pick, replace, ifElse, chain, prop,
} = require('ramda');
const connect = require('./index');
const { entities, entityMethods } = require('../entities');
const typeToBundle = require('./typeToBundle');

const drupalMetaFields = {
  attributes: [
    'drupal_internal__id',
    'drupal_internal__revision_id',
    'langcode',
    'revision_created',
    'revision_log_message',
    'default_langcode',
    'revision_translation_affected',
    'revision_default',
  ],
  relationships: ['revision_user'],
};

const dropMilliseconds = replace(/\.\d\d\d/, '');
const insertMilliseconds = str => new Date(str).toISOString();

const typeConst = (entName, d9Schema) => ({
  const: typeToBundle(entName, d9Schema.definitions.type.const),
});

const transformD9Schema = entName => d9Schema => ({
  ...omit(['definitions', 'allOf'], d9Schema),
  type: 'object',
  properties: {
    id: { type: 'string' },
    type: typeConst(entName, d9Schema),
    meta: { type: 'object' },
    attributes: omit(
      drupalMetaFields.attributes,
      d9Schema.definitions.attributes,
    ),
    relationships: omit(
      drupalMetaFields.relationships,
      d9Schema.definitions.relationships,
    ),
  },
});

const transformRemoteAttributes = compose(
  evolve({ timestamp: insertMilliseconds }),
  omit(drupalMetaFields.attributes),
);

const transformRemoteEntity = entName => remote => ({
  id: remote.id,
  type: typeToBundle(entName, remote.type),
  meta: {
    attributes: pick(drupalMetaFields.attributes, remote.attributes),
    relationships: pick(drupalMetaFields.relationships, remote.relationships),
  },
  attributes: transformRemoteAttributes(remote.attributes),
  relationships: omit(drupalMetaFields.relationships, remote.relationships),
});

const ifArrayMap = fn => ifElse(Array.isArray, chain(fn), fn);

const handleResponse = entName => compose(
  ifArrayMap(transformRemoteEntity(entName)),
  prop('data'),
);

const transformLocalEntity = entName => compose(
  dissoc('meta'),
  evolve({
    type: t => `${entName}--${t}`,
    attributes: {
      timestamp: dropMilliseconds,
    },
  }),
);

function adapter(model, opts) {
  const { host, ...rest } = opts;
  const getTypes = entity => Object.keys(model.schema.get(entity));
  const connection = connect(host, { getTypes, ...rest });

  return {
    ...connection,
    schema: {
      fetch(entName, type) {
        return connection.schema.fetch(entName, type)
          .then((schemata) => {
            if (!entName) {
              return mapObjIndexed(
                (entitySchemata, entityName) => map(
                  transformD9Schema(entityName),
                  entitySchemata,
                ),
                schemata,
              );
            }
            if (!type) {
              return map(transformD9Schema(entName), schemata);
            }
            return transformD9Schema(entName)(schemata);
          });
      },
    },
    ...entityMethods(entities, ({ name, shortName }) => ({
      ...connection[shortName],
      fetch: (...args) => connection[shortName].fetch(...args)
        .then(ifArrayMap(handleResponse(name))),
      send: compose(
        connection[shortName].send,
        transformLocalEntity(name),
      ),
    })),
  };
}

module.exports = adapter;
