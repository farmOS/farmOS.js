/* eslint-disable import/prefer-default-export */
import evolve from 'ramda/src/evolve.js';
import map from 'ramda/src/map.js';
import mergeLeft from 'ramda/src/mergeLeft.js';
import omit from 'ramda/src/omit.js';
import pick from 'ramda/src/pick.js';
import pickBy from 'ramda/src/pickBy.js';
import { getPath } from './properties.js';
import { isObject, hasLogicalKeyword } from './utils.js';

/**
 * @typedef {import('./reference').JsonSchema} JsonSchema
 * @typedef {import('./reference').JsonSchemaDereferenced} JsonSchemaDereferenced
 */

/** Transform function
 * @typedef {(JsonSchemaDereferenced) => *} SchemaTransform
 */

/**
 * Get the default value at a given path for a given schema.
 * @param {JsonSchemaDereferenced} schema
 * @param {string[]|string} [path] - A property name or array of property names.
 * @param {Object} [options]
 * @param {Object.<string, SchemaTransform>} [options.byType]
 * @param {Object.<string, SchemaTransform>} [options.byFormat]
 * @param {Object.<string, SchemaTransform>|string|boolean} [options.byProperty]
 * @param {Object} [options.use]
 * @returns {*}
 */
export const getDefault = (schema, path = [], options = {}) => {
  const subschema = getPath(schema, path);
  if (!isObject(subschema)) return undefined;
  if ('default' in subschema) return subschema.default;

  // For recursive calls
  /** @type {(sub: JsonSchemaDereferenced) => *} */
  const getDef = sub => getDefault(sub, [], options);
  /** @typedef {JsonSchemaDereferenced[]|Object.<string, JsonSchemaDereferenced>} SchemaFunctor */
  /** @type {(sub: SchemaFunctor) => Array|Object} */
  const mapGetDef = map(getDef);

  if (hasLogicalKeyword(subschema)) {
    return evolve({
      allOf: mapGetDef,
      anyOf: mapGetDef,
      oneOf: mapGetDef,
      not: getDef,
    }, subschema);
  }
  const { type } = subschema;
  const {
    byType, byFormat, byProperty = false, use,
  } = options;
  if (byType && type in byType) {
    const { [type]: transform } = byType;
    return transform(subschema);
  }
  if (type === 'string') {
    if (byFormat && 'format' in subschema && subschema.format in byFormat) {
      const { [subschema.format]: transform } = byFormat;
      return transform(subschema);
    }
  }
  if (use && ['number', 'integer'].includes(type)) {
    const keywords = ['minimum', 'maximum', 'multipleOf'];
    const useOptions = Array.isArray(use) ? use : [use];
    const kw = useOptions.find(k => k in subschema && keywords.includes(k));
    return subschema[kw];
  }
  if (type === 'object') {
    if (byProperty && 'properties' in subschema) {
      const { required = [], properties } = subschema;
      const pickResolved = pickBy(v => v !== undefined);
      if (isObject(byProperty)) {
        const optionsDefaults = evolve(byProperty, properties);
        const nonOptionsSchema = omit(Object.keys(byProperty), properties);
        const nonOptionsDefaults = pickResolved(mapGetDef(nonOptionsSchema));
        return mergeLeft(optionsDefaults, nonOptionsDefaults);
      }
      if (byProperty === 'required' && Array.isArray(required)) {
        const requiredSchema = pick(required, properties);
        return mapGetDef(requiredSchema);
      }
      return pickResolved(mapGetDef(properties));
    }
  }
  if ('const' in subschema) return subschema.const;
  if (type === 'null') {
    // This is the only case that should return null; if a default can't be
    // resolved, undefined should be returned, as below.
    return null;
  }
  return undefined;
};
