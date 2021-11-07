import anyPass from 'ramda/src/anyPass.js';
import compose from 'ramda/src/compose.js';
import curry from 'ramda/src/curry.js';
import has from 'ramda/src/has.js';
import map from 'ramda/src/map.js';
import reduce from 'ramda/src/reduce.js';

export const hasAny = compose(anyPass, map(has));

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
