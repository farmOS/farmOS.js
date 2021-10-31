import anyPass from 'ramda/src/anyPass.js';
import compose from 'ramda/src/compose.js';
import has from 'ramda/src/has.js';
import map from 'ramda/src/map.js';

/**
 * @typedef {import('./reference').JsonSchema} JsonSchema
 * @typedef {import('./reference').JsonSchemaDereferenced} JsonSchemaDereferenced
 */

export const logicalKeywords = ['allOf', 'anyOf', 'oneOf', 'not'];
const hasAny = compose(anyPass, map(has));
/** @type {(JsonSchema) => boolean} */
export const hasLogicalKeyword = hasAny(logicalKeywords);

/** @type {(x: any) => Boolean} */
export const isObject = x => typeof x === 'object' && x !== null;
/** @type {(x: any) => Boolean} */
export const boolOrThrow = (x) => {
  if (typeof x === 'boolean') return x;
  throw new Error(`Invalid schema: ${x}`);
};
