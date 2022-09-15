import append from 'ramda/src/append.js';
import chain from 'ramda/src/chain.js';
import compose from 'ramda/src/compose.js';
import concat from 'ramda/src/concat.js';
import evolve from 'ramda/src/evolve.js';
import map from 'ramda/src/map.js';
import path from 'ramda/src/path.js';
import reduce from 'ramda/src/reduce.js';
import client from '../index.js';
import defaultEntities, { entityMethods } from '../../entities.js';
import {
  generateFieldTransforms, transformD9Schema, transformLocalEntity,
  transformFetchResponse, transformSendResponse,
} from './transformations.js';
import { parseEntityType } from '../../utils.js';

/**
 * @typedef {import('../../json-schema/reference').JsonSchema} JsonSchema
 * @typedef {import('../../model/index').EntitySchemata} EntitySchemata
 * @typedef {import('../../model/index').BundleSchemata} BundleSchemata
 */

const DRUPAL_PAGE_LIMIT = 50;

/**
 * @typedef {Array<{ type: String, filter: Object|Array }>} FiltersByType
 */
/**
 * @param {Object|Array|Undefined} filter
 * @param {Array<String>} validTypes
 * @returns {FiltersByType}
 */
export function splitFilterByType(filter, validTypes) {
  /** @type {FiltersByType} */
  const filtersByType = [];

  // A plain array is equivalent to an object w/ an array as the `$or` property.
  // In both cases, the array must itself contain valid filters, which can be
  // evaluated recursively.
  if (Array.isArray(filter.$or) || Array.isArray(filter)) {
    (filter.$or || filter).forEach((f) => {
      splitFilterByType(f, validTypes).forEach((tFilter) => {
        // Instead of just adding every tFilter to tiltersByType, look for a
        // matching filter that's already been added.
        const match = filtersByType.find(fbt => fbt.type === tFilter.type);
        // If so, combine them into a single object w/ an array of filters.
        if (match) {
          // The matching filter, the current filter, or both can be arrays,
          // so concat onto an empty array to flatten them and reassign it.
          match.filter = [].concat(match.filter, tFilter);
        } else {
          // Otherwise, add the whole object as-is.
          filtersByType.push(tFilter);
        }
      });
    });
    return filtersByType;
  }

  // The filter must either be an object (logical $and) or an array (logical $or).
  // If it's neither, then it's not a valid filter, so return the empty array.
  if (typeof filter !== 'object') return filtersByType;

  // Technically any object is equivalent to an object w/ an `$and` property,
  // which is itself an object. Also, one type filter is not permitted to be
  // nested under another, so we can safely pluck the type and ignore the rest.
  const { type, ...rest } = typeof filter.$and === 'object' ? filter.$and : filter;

  // The case of filtering by a single type.
  if (typeof type === 'string') {
    if (!validTypes.includes(type)) return filtersByType;
    filtersByType.push({ type, filter: rest });
  }
  // The case of filtering by multiple types.
  if (Array.isArray(type)) {
    type.forEach((t) => {
      if (validTypes.includes(t)) {
        filtersByType.push({ type: t, filter: rest });
      }
    });
  }
  // An undefined or null type is interpreted as ALL types, so push the rest of
  // the filter properties onto the array for each and every valid type.
  if ([undefined, null].includes(type)) {
    validTypes.forEach((t) => {
      filtersByType.push({ type: t, filter: rest });
    });
  }
  return filtersByType;
}

const aggregateBundles = reduce((aggregate, result) => {
  const { reason, value, status } = result;
  if (status === 'fulfilled') {
    const nextData = chain(path(['data', 'data']), value);
    return evolve({
      data: concat(nextData),
      fulfilled: concat(value),
    }, aggregate);
  }
  return evolve({
    rejected: append(reason),
  }, aggregate);
}, { data: [], fulfilled: [], rejected: [] });

/**
 * @typedef {import('../../entities.js').EntityConfig} EntityConfig
 */
/**
 * @param {import('../../model/index').FarmModel} model
 * @param {Object} opts
 * @property {Object<String, EntityConfig>} [opts.entities=defaultEntities]
 * @returns {import('../index.js').FarmClient}
 */
export default function adapter(model, opts) {
  const {
    host, maxPageLimit = DRUPAL_PAGE_LIMIT, entities = defaultEntities, ...rest
  } = opts;
  const connection = client(host, { ...rest, entities });
  const initSchemata = model.schema.get();
  let fieldTransforms = generateFieldTransforms(initSchemata);
  model.schema.on('set', (schemata) => {
    fieldTransforms = generateFieldTransforms(schemata);
  });

  // For chaining consecutive requests for the next page of resources until the
  // provided limit is reached, or there are no further resources to fetch.
  const chainRequests = (req, limit, prev = [], total = 0) => req.then((res) => {
    let next = path(['data', 'links', 'next', 'href'], res);
    const resLength = path(['data', 'data', 'length'], res);
    const newTotal = total + resLength;
    const all = prev.concat(res);
    if (!next || newTotal >= limit) return all;
    const remainder = limit - newTotal;
    if (remainder < maxPageLimit) next = `${next}&page[limit]=${remainder}`;
    const url = new URL(next);
    const nextReq = connection.request(url.pathname + url.search);
    return chainRequests(nextReq, limit, all, newTotal);
  });

  return {
    ...connection,
    schema: {
      fetch(entName, bundle) {
        return connection.schema.fetch(entName, bundle)
          .then((schemata) => {
            if (!entName) {
              return map((s) => map(transformD9Schema, s), schemata);
            }
            if (!bundle) {
              return map(transformD9Schema, schemata);
            }
            return transformD9Schema(schemata);
          });
      },
    },
    ...entityMethods(({ nomenclature: { name, shortName } }) => ({
      ...connection[shortName],
      /** @type {(options: import('../fetch.js').FetchOptions) => Promise} */
      fetch: (options) => {
        const { filter, limit, sort } = options;
        const validTypes = Object.keys(model.schema.get(name)).map(b => `${name}--${b}`);
        const bundleRequests = splitFilterByType(filter, validTypes).map((f) => {
          const { type, ...tFilter } = f;
          /** @type {import('../fetch.js').FetchOptions} */
          const fetchOptions = { ...tFilter, limit, sort };
          const { bundle } = parseEntityType(type);
          if (name in fieldTransforms && bundle in fieldTransforms[name]) {
            fetchOptions.filterTransforms = fieldTransforms[name][bundle];
          }
          const req = connection[shortName].fetch(bundle, fetchOptions);
          return chainRequests(req, limit);
        });
        const handleBundleResponse = compose(
          transformFetchResponse(name),
          aggregateBundles,
        );
        return Promise.allSettled(bundleRequests)
          .then(handleBundleResponse);
      },
      send: data => connection[shortName].send(
        parseEntityType(data.type).bundle,
        transformLocalEntity(data, fieldTransforms),
      ).then(transformSendResponse(name)),
    }), entities),
  };
}
