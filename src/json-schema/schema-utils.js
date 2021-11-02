import { hasAny } from '../utils.js';

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
