import compose from 'ramda/src/compose.js';
import dissoc from 'ramda/src/dissoc.js';
import evolve from 'ramda/src/evolve.js';
import filter from 'ramda/src/filter.js';
import has from 'ramda/src/has.js';
import map from 'ramda/src/map.js';
import mapObjIndexed from 'ramda/src/mapObjIndexed';
import omit from 'ramda/src/omit.js';
import pick from 'ramda/src/pick.js';
import prop from 'ramda/src/prop.js';
import path from 'ramda/src/path.js';
import replace from 'ramda/src/replace.js';
import unless from 'ramda/src/unless.js';
import { getPath } from '../../json-schema/index.js';
import { parseEntityType } from '../../types.js';
import { isObject } from '../../utils.js';

const dropMilliseconds = replace(/\.\d\d\d/, '');
const safeIso = t => t && new Date(t).toISOString();
const safeUnix = t => t && Math.floor(new Date(t).valueOf() / 1000);

// These functions correspond to string formats in the JSON Schema for an entity
// and are used to convert between local formats and server-supported formats.
const transformsByFormat = {
  'date-time': safeUnix,
};
const transformsByMetafield = {
  created: safeUnix,
  changed: safeUnix,
  revision_created: safeUnix,
};
/**
 * The transforms need to be regenerated whenever the schemata are set, so the
 * format transforms can be mapped to every field with that format.
 * @param {import('../../model/index').EntitySchemata} schemata
 * @returns {FieldTransforms}
 */
export const generateFieldTransforms = (schemata) => {
  const formats = transformsByFormat;
  /** @type {FieldTransforms} */
  const transforms = {};
  const entities = Object.keys(schemata);
  entities.forEach((entity) => {
    transforms[entity] = {};
    Object.entries(schemata[entity]).forEach(([bundle, schema]) => {
      transforms[entity][bundle] = { ...transformsByMetafield };
      const attributes = getPath(schema, 'attributes');
      const relationships = getPath(schema, 'relationships');
      const fieldSchemata = { ...attributes.properties, ...relationships.properties };
      Object.entries(fieldSchemata).forEach(([field, sub]) => {
        if (isObject(sub) && 'format' in sub && sub.format in formats) {
          const { [sub.format]: transform } = formats;
          transforms[entity][bundle][field] = transform;
        }
      });
    });
  });
  return transforms;
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
  user: {
    langcode: 'en',
  },
};

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

export const transformD9Schema = (d9Schema) => {
  const {
    $id, $schema, title, definitions: { type, attributes, relationships },
  } = d9Schema;
  const { entity, bundle } = parseEntityType(type.const);
  const defaultTitle = `${bundle} ${entity}`;

  const transformAttributeFields = evolve({
    properties: mapObjIndexed((subschema, propName) => {
      const hasOwnDefault = isObject(subschema) && 'default' in subschema;
      if (hasOwnDefault) return subschema;
      const standardDefault = path([entity, propName], attributeDefaults);
      if (!standardDefault) return subschema;
      return { ...subschema, default: standardDefault };
    }),
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
    removeDrupalMetaSchemas(drupalMetaFields.relationships.concat(`${entity}_type`)),
  );

  return {
    $schema,
    $id,
    title: title || defaultTitle,
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      type,
      meta: { type: 'object' },
      attributes: transformAttributesSchema(attributes),
      relationships: transformRelationshipsSchema(relationships),
    },
  };
};

/**
 * @typedef {Object.<string, function>} BundleTransforms
 * @typedef {Object.<string, BundleTransforms>} EntityTransforms
 * @typedef {Object.<string, EntityTransforms>} FieldTransforms
 */
/**
 * @typedef {Function} safeTransforms
 * @param {String} type Entity type (eg, 'log--activity')
 * @param {FieldTransforms} [fns] Collection of tranform functions
 * @returns {BundleTransforms}
 */
const safeTransforms = (type, fns = {}) => {
  const { entity, bundle } = parseEntityType(type);
  const transforms = fns[entity] && fns[entity][bundle];
  return transforms || {};
};

/**
 * @type {(relationship: object|array) => object} For nesting relationships and
 * other fields withn objects under the property 'data'.
 */
const nestData = unless(has('data'), data => ({ data }));

/**
 * For transforming local entities into acceptable format for D9 JSON:API farmOS.
 * @param {import('../../entities').Entity} data The actual data of such an entity
 * @param {FieldTransforms} transforms Collection of transforms
 * @returns {Object}
 */
export const transformLocalEntity = (data, transforms) => compose(
  dissoc('meta'),
  evolve({
    attributes: {
      /**
       * @see https://github.com/farmOS/farmOS.js/issues/74
       */
      archived: dropMilliseconds,
      timestamp: dropMilliseconds,
      ...safeTransforms(data.type, transforms),
    },
    relationships: map(nestData),
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
  ...map(() => safeIso(attrs.changed), omit(drupalMetaFields.attributes, attrs)),
  ...map(() => safeIso(rels.changed), omit(drupalMetaFields.relationships, rels)),
});

const emptyAttrs = { created: null, changed: null, drupal_internal__id: null };
export const transformRemoteEntity = (setLastSync = false) => (remote) => {
  const {
    id, type, attributes = emptyAttrs, relationships = {},
  } = remote;
  const { entity } = parseEntityType(type);
  return {
    id,
    type,
    meta: {
      created: safeIso(attributes.created),
      changed: safeIso(attributes.changed),
      fieldChanges: makeFieldChanges(attributes, relationships),
      conflicts: [],
      remote: {
        lastSync: setLastSync ? new Date().toISOString() : null,
        url: `/${entity}/${attributes.drupal_internal__id}`,
        meta: {
          attributes: pick(drupalMetaFields.attributes, attributes),
          relationships: pick(drupalMetaFields.relationships, relationships),
        },
      },
    },
    attributes: transformRemoteAttributes(attributes),
    relationships: transformRemoteRelationships(relationships),
  };
};

export const transformFetchResponse = evolve({
  data: map(transformRemoteEntity(false)),
});

export const transformSendResponse = compose(
  transformRemoteEntity(true),
  path(['data', 'data']),
);
