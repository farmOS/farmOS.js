import evolve from 'ramda/src/evolve.js';
import map from 'ramda/src/map.js';
import { getPath } from './properties.js';
import { hasLogicalKeyword } from './schema-utils.js';
import { isObject } from '../utils.js';

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
const getDefault = (schema, path = [], options = {}) => {
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
    byType, byFormat, use,
  } = options;
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
  if ('const' in subschema) return subschema.const;
  // Evaluate byType last, so options of higher specificity take precedence.
  if (byType && type in byType) {
    const { [type]: transform } = byType;
    return transform(subschema);
  }
  if (type === 'null') {
    // This is the only case that should return null; if a default can't be
    // resolved, undefined should be returned, as below.
    return null;
  }
  return undefined;
};

export default getDefault;
