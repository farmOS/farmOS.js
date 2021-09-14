const {
  compose, dissoc, evolve, omit, mapObjIndexed, map, pick, replace, path,
} = require('ramda');
const connect = require('./index');
const { entities, entityMethods } = require('../entities');
const typeToBundle = require('./typeToBundle');

// These functions correspond to entity fields and provide transformations that
// are passed ultimately to parseFilter, so it can compare values of the same
// format. This is not a long term solution, and should eventually be replaced
// by transforms based on the `format` keyword in JSON Schema, independent of
// the actual field names.
const filterTransforms = {
  timestamp: t => Math.floor(new Date(t).valueOf() / 1000),
};

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

const transformSendResponse = name => compose(
  transformRemoteEntity(name),
  path(['data', 'data']),
);

const transformLocalEntity = (entName, data) => compose(
  dissoc('meta'),
  evolve({
    type: t => `${entName}--${t}`,
    attributes: {
      timestamp: dropMilliseconds,
    },
  }),
)(data);

function parseBundles(filter, validTypes) {
  const bundles = [];
  // The filter must either be an object (logical $and) or an array (logical $or).
  if (Array.isArray(filter) || Array.isArray(filter.$or)) {
    (Array.isArray(filter) ? filter : filter.$or).forEach((f) => {
      parseBundles(f).forEach(({ name, filter: bundleFilter }) => {
        const i = bundles.findIndex(b => b.name === name);
        if (i > -1) {
          // Concat on an empty array to flatten either bundle or both.
          bundles[i].filter = [].concat(bundles[i].filter, bundleFilter);
        } else {
          bundles.push({ name, filter: bundleFilter });
        }
      });
    });
    return bundles;
  }
  if (typeof filter !== 'object') throw new Error(`Invalid filter: ${filter}`);
  const { type, ...rest } = typeof filter.$and === 'object' ? filter.$and : filter;
  if (typeof type === 'string') {
    if (!validTypes.includes(type)) throw new Error(`Invalid type filter: ${type}`);
    bundles.push({ name: type, filter: rest });
  }
  if (Array.isArray(type)) {
    type.forEach((t) => {
      if (!validTypes.includes(t)) throw new Error(`Invalid type filter: ${t}`);
      bundles.push({ name: t, filter: rest });
    });
  }
  if ([undefined, null].includes(type)) {
    validTypes.forEach((t) => {
      bundles.push({ name: t, filter: rest });
    });
  }
  return bundles;
}

const aggregateBundles = (transform = a => a) => results =>
  results.reduce(({ data, fulfilled, rejected }, { reason, value, status }) => {
    if (status === 'fulfilled') {
      const ents = value.data.data.map(transform);
      return {
        data: data.concat(ents),
        fulfilled: fulfilled.concat(value),
        rejected,
      };
    }
    return {
      data,
      fulfilled,
      rejected: rejected.concat(reason),
    };
  }, { data: [], fulfilled: [], rejected: [] });

const fetchBundles = (getTypes, request, transform) => ({ filter }) => {
  const validTypes = getTypes();
  const bundles = parseBundles(filter, validTypes);
  const bundleRequests = bundles.map(({ name: bundle, filter: bundleFilter }) =>
    request(bundle, { filter: bundleFilter }));
  return Promise.allSettled(bundleRequests)
    .then(aggregateBundles(transform));
};

function adapter(model, opts) {
  const { host, ...rest } = opts;
  const connection = connect(host, { ...rest, filterTransforms });

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
      fetch: fetchBundles(
        () => Object.keys(model.schema.get(name)),
        connection[shortName].fetch,
        transformRemoteEntity(name),
      ),
      send: data => connection[shortName].send(
        data.type,
        transformLocalEntity(name, data),
      ).then(transformSendResponse(name)),
    })),
  };
}

module.exports = adapter;
