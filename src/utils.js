import compose from 'ramda/src/compose';
import curry from 'ramda/src/curry.js';
import match from 'ramda/src/match';
import reduce from 'ramda/src/reduce.js';

/** @type {(x: any) => Boolean} */
export const isObject = x => typeof x === 'object' && x !== null;

export const reduceObjIndexed = curry((fn, init, obj) => reduce(
  (acc, [key, val]) => fn(acc, val, key),
  init,
  Object.entries(obj),
));

export const createObserver = () => {
  const listeners = new Map();
  const subscribe = ((callback) => {
    listeners.set(callback, callback);
    return () => {
      listeners.delete(callback);
    };
  });
  const next = (event) => {
    listeners.forEach((callback) => {
      callback(event);
    });
  };
  return { subscribe, next };
};

/**
 * @type {RegExp} Identifies valid format for an entity type (eg 'log--activity)
 * and groups matches by type, entity & bundle.
 */
export const entityTypeRegEx = /(\w+)--(\w+)/;
/**
 * @type {Function} Validates a string as an entity type and parses it.
 * @param {String} type A possible entity type (eg, 'log--activity').
 * @returns {{ type?: String, entity?: String, bundle?: String }}
 *  */
export const parseEntityType = compose(
  ([type, entity, bundle]) => ({ type, entity, bundle }),
  match(entityTypeRegEx),
);
/**
 * @type {() => Object} Takes any object containing entity data, such as props
 * or fields, then normalizes the type, bundle & field.
 * @param {{ type?: String, entity?: String, bundle?: string }} fields
 * @returns {{ type?: String, entity?: String, bundle?: String }}
 */
export function parseTypeFromFields(fields = {}) {
  let { entity, bundle, type } = fields;
  if (type) ({ entity, bundle } = parseEntityType(type));
  if (!type && entity && bundle) type = `${entity}--${bundle}`;
  return { entity, bundle, type };
}
