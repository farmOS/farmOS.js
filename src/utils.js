import append from 'ramda/src/append.js';
import curry from 'ramda/src/curry.js';
import evolve from 'ramda/src/evolve.js';
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
 * @template D
 */
/**
/**
 * @typedef {{ data: D, fulfilled: any[], rejected: any[] }} AltogetherResult
 * @property {D} data
 * @property {any[]} fulfilled
 * @property {any[]} rejected
 */
/**
 * @typedef {(promises: Promise[]) => AltogetherResult} AltogetherPartial
 */

/**
 * Handles a list of promises of compatible type that will be executed in parallel.
 * It wraps `Promise.allSettled()` and partitions the results based on their status,
 * 'fulfilled' or 'rejected', while also applying a transform function that iterates
 * through all fulfilled values and returns the cumulated result as 'data'.
 * @typedef {Function} altogether
 * @param {Function} transform
 * @param {D} [initData=null]
 * @param {Promise[]} [promises=[]]
 * @returns {Promise<AltogetherPartial|AltogetherResult>}
 */
export const altogether = curry((transform, initData, promises) =>
  Promise.allSettled(promises || []).then(reduce((all, result) => {
    const { reason, value, status } = result;
    if (status === 'fulfilled') {
      return evolve({
        data: d => transform(value, d),
        fulfilled: append(value),
      }, all);
    }
    return evolve({
      rejected: append(reason),
    }, all);
  }, { data: initData || null, fulfilled: [], rejected: [] })));
