import map from 'ramda/src/map.js';
import mergeWith from 'ramda/src/mergeWith.js';
import { logicalKeywords, hasLogicalKeyword } from './schema-utils.js';
import { isObject } from '../utils.js';

/**
 * @typedef {import('./reference').JsonSchema} JsonSchema
 * @typedef {import('./reference').JsonSchemaDereferenced} JsonSchemaDereferenced
 */

/**
 * Provide a dereferenced schema and get back the object corresponding to the
 * "properties" keyword. A schema of type "array" will also be checked for the
 * "items" keyword and any corresponding properties it has. Properties found
 * under contitional keywords "allOf", "anyOf", "oneOf" and "not" will be
 * merged; however, the "$ref" keyword will NOT be handled and will throw an
 * error if encountered.
 * @param {JsonSchemaDereferenced} schema - Must NOT contain the "$ref" keyword,
 * nor subschemas containing "$ref".
 * @returns {Object.<string, JsonSchemaDereferenced>}
 */
export const getProperties = (schema) => {
  if (!isObject(schema)) return {};
  if ('$ref' in schema) {
    // It is the responsibility of the caller to dereference the schema first.
    const msg = `Unknown schema reference ($ref): "${schema.$ref}". `
    + 'Try dereferencing the schema before trying to access its properties or defaults.';
    throw new Error(msg);
  }
  if ('properties' in schema) {
    return schema.properties;
  }
  if ('items' in schema && 'properties' in schema.items) {
    return schema.items.properties;
  }
  if (hasLogicalKeyword(schema)) {
    const keyword = logicalKeywords.find(k => k in schema);
    if (keyword === 'not') {
      return map(p => ({ not: p }), getProperties(schema.not));
    }
    return schema[keyword].reduce((props, subschema) => {
      const subProps = getProperties(subschema);
      const strategy = (b, a) => {
        const aList = keyword in a ? a[keyword] : [a];
        const bList = keyword in b ? b[keyword] : [b];
        return { [keyword]: [...aList, ...bList] };
      };
      return mergeWith(strategy, props, subProps);
    }, {});
  }
  return {};
};

/**
 * Provide a dereferenced schema of type 'object', and get back the subschema
 * corresponding to the specified property name.
 * @param {JsonSchemaDereferenced} schema - Must NOT contain the `$ref` keyword,
 * nor subschemas containing `$ref`.
 * @param  {string} property - The name of a property under the `properties` keyword.
 * @returns {JsonSchemaDereferenced}
 */
export const getProperty = (schema, property) => {
  if (typeof schema === 'boolean') return {};
  if (typeof property !== 'string') throw new Error(`Invalid property: ${property}`);
  const properties = getProperties(schema);
  if (property in properties) {
    return properties[property];
  }
  return {};
};

/**
 * Provide a dereferenced schema of type 'object', and get back the subschema
 * corresponding to the specified property name, or to the specified path.
 * @param {JsonSchemaDereferenced} schema - Must NOT contain the `$ref` keyword,
 * nor subschemas containing `$ref`.
 * @param  {...string|string[]} path - A property name, or array of property names.
 * @returns {JsonSchemaDereferenced}
 */
export const getPath = (schema, ...path) => {
  if (typeof schema === 'boolean') return {};
  const pathArray = path.flat();
  if (pathArray.length === 0) return schema;
  const [head, ...tail] = pathArray;
  if (typeof head !== 'string') throw new Error(`Invalid path in subschema: ${head}`);
  const subschema = getProperty(schema, head);
  if (!isObject(subschema)) return {};
  if (tail.length > 0) {
    return getPath(subschema, tail);
  }
  return subschema;
};

/**
 * Provide a dereferenced schema of type 'object', and get back a list of all its
 * specified properties, or the properties of the subschema indicated by its path.
 * @param {JsonSchemaDereferenced} schema - Must NOT contain the `$ref` keyword, nor
 * subschemas containing `$ref`.
 * @param  {...string|string[]} [path] - A property name, or array of property names.
 * @returns {string[]}
 */
export const listProperties = (schema, ...path) => {
  if (typeof schema === 'boolean') return [];
  const subschema = path.length > 0 ? getPath(schema, path.flat()) : schema;
  if ('properties' in subschema) {
    return Object.keys(subschema.properties);
  }
  return [];
};
