import assoc from 'ramda/src/assoc.js';
import compose from 'ramda/src/compose.js';
import dissoc from 'ramda/src/dissoc.js';
import evolve from 'ramda/src/evolve.js';
import has from 'ramda/src/has.js';
import filter from 'ramda/src/filter.js';
import map from 'ramda/src/map.js';
import omit from 'ramda/src/omit.js';
import pick from 'ramda/src/pick.js';
import prop from 'ramda/src/prop.js';
import path from 'ramda/src/path.js';
import replace from 'ramda/src/replace.js';
import unless from 'ramda/src/unless.js';
import typeToBundle from './typeToBundle.js';
import { getPath } from '../json-schema/index.js';
import { isObject } from '../utils.js';

const dropMilliseconds = replace(/\.\d\d\d/, '');
const safeIso = t => t && new Date(t).toISOString();

// These functions provide transformations that are ultimately passed to
// parseFilter, so it can compare values of the same format.
const filterTransformsByFormat = {
  'date-time': t => Math.floor(new Date(t).valueOf() / 1000),
};
// The transforms need to be regenerated whenever the schemata are set, so the
// format transforms can be mapped to every field with that format.
export const generateFilterTransforms = (schemata) => {
  const formats = filterTransformsByFormat;
  const filterTransforms = {};
  const entities = Object.keys(schemata);
  entities.forEach((entity) => {
    filterTransforms[entity] = {};
    Object.entries(schemata[entity]).forEach(([bundle, schema]) => {
      filterTransforms[entity][bundle] = {};
      const attributes = getPath(schema, 'attributes');
      const relationships = getPath(schema, 'relationships');
      Object.entries({ ...attributes, ...relationships }).forEach(([field, sub]) => {
        if (isObject(sub) && 'format' in sub && sub.format in formats) {
          const { [sub.format]: transform } = formats;
          filterTransforms[entity][bundle][field] = transform;
        }
      });
    });
  });
  return filterTransforms;
};

export const drupalMetaFields = {
  attributes: [
    'created',
    'changed',
    'drupal_internal__id',
    'drupal_internal__revision_id',
    'langcode',
    'revision_created',
    'revision_log_message',
    'default_langcode',
    'revision_translation_affected',
    'revision_default',
  ],
  relationships: ['revision_user', 'uid'],
};
const removeDrupalMetaSchemas = drupalFields => evolve({
  properties: omit(drupalFields),
  required: filter(field => !drupalFields.includes(field)),
});

// Drupal's jsonapi_schema module classifies certain enumerable values as plain
// strings; e.g., "status" should be an enumerable of ['pending', 'done']. To
// avoid errors w/o enums a default is provided.
const attributeDefaults = {
  asset: {
    status: 'active',
  },
  log: {
    status: 'pending',
  },
  plan: {
    status: 'active',
  },
  quantity: {},
  taxonomy_term: {},
  user: {
    langcode: 'en',
  },
};
const addSchemaDefaults = compose(
  evolve,
  map(defaultValue => unless(
    has('default'),
    assoc('default', defaultValue),
  )),
);

// Relationships are comprised of either one resource identifier objects, or an
// array of resource identifier objects. For now, we'll just use the same schema
// regardless of the resource type, but the type could be constrained to an enum
// or a const value.
const transformResourceSchema = (subschema) => {
  const resourceSchema = {
    type: 'object',
    required: ['id', 'type'],
    properties: {
      id: {
        type: 'string',
        title: 'Resource ID',
        format: 'uuid',
        maxLength: 128,
      },
      type: { type: 'string' },
    },
  };
  const { properties: { data: { type } }, title } = subschema;
  if (type === 'object') {
    return { title, ...resourceSchema };
  }
  return { type, title, items: resourceSchema };
};

export const transformD9Schema = entName => (d9Schema) => {
  const {
    $id, $schema, title, definitions: { type, attributes, relationships },
  } = d9Schema;
  const bundle = typeToBundle(entName, type.const);
  const defaultTitle = `${bundle} ${entName}`;

  const transformAttributeFields = evolve({
    properties: addSchemaDefaults(attributeDefaults[entName]),
  });
  const transformRelationshipFields = evolve({
    properties: map(transformResourceSchema),
  });
  const transformAttributesSchema = compose(
    transformAttributeFields,
    removeDrupalMetaSchemas(drupalMetaFields.attributes),
  );
  const transformRelationshipsSchema = compose(
    transformRelationshipFields,
    removeDrupalMetaSchemas(drupalMetaFields.relationships.concat(`${entName}_type`)),
  );

  return {
    $schema,
    $id,
    title: title || defaultTitle,
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      type: { const: bundle },
      meta: { type: 'object' },
      attributes: transformAttributesSchema(attributes),
      relationships: transformRelationshipsSchema(relationships),
    },
  };
};

export const transformLocalEntity = (entName, data) => compose(
  dissoc('meta'),
  evolve({
    type: t => `${entName}--${t}`,
    attributes: { timestamp: dropMilliseconds },
    relationships: map(r => ({ data: r })),
  }),
)(data);

const transformRemoteAttributes = compose(
  evolve({ timestamp: safeIso }),
  omit(drupalMetaFields.attributes),
);
const transformRemoteRelationships = compose(
  map(prop('data')),
  omit(drupalMetaFields.attributes),
);
const makeFieldChanges = (attrs, rels) => ({
  ...map(() => attrs.changed, omit(drupalMetaFields.attributes, attrs)),
  ...map(() => attrs.changed, omit(drupalMetaFields.relationships, rels)),
});

const emptyAttrs = { created: null, changed: null, drupal_internal__id: null };
const transformRemoteEntity = (entName, setLastSync = false) => ({
  id, type, attributes = emptyAttrs, relationships = {},
}) => ({
  id,
  type: typeToBundle(entName, type),
  meta: {
    created: safeIso(attributes.created),
    changed: safeIso(attributes.changed),
    fieldChanges: makeFieldChanges(attributes, relationships),
    remote: {
      lastSync: setLastSync ? new Date().toISOString() : null,
      url: `/${entName}/${attributes.drupal_internal__id}`,
      meta: {
        attributes: pick(drupalMetaFields.attributes, attributes),
        relationships: pick(drupalMetaFields.relationships, relationships),
      },
    },
  },
  attributes: transformRemoteAttributes(attributes),
  relationships: transformRemoteRelationships(relationships),
});

export const transformFetchResponse = name => evolve({
  data: map(transformRemoteEntity(name)),
});

export const transformSendResponse = name => compose(
  transformRemoteEntity(name, true),
  path(['data', 'data']),
);
