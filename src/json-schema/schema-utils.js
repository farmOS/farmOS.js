import anyPass from 'ramda/src/anyPass.js';
import compose from 'ramda/src/compose.js';
import has from 'ramda/src/has.js';
import map from 'ramda/src/map.js';

const hasAny = compose(anyPass, map(has));

/**
 * @typedef {import('./reference').JsonSchema} JsonSchema
 * @typedef {import('./reference').JsonSchemaDereferenced} JsonSchemaDereferenced
 */

export const logicalKeywords = ['allOf', 'anyOf', 'oneOf', 'not'];
/** @type {(JsonSchema) => boolean} */
export const hasLogicalKeyword = hasAny(logicalKeywords);

/** @type {(x: any) => Boolean} */
export const boolOrThrow = (x) => {
  if (typeof x === 'boolean') return x;
  throw new Error(`Invalid schema: ${x}`);
};
