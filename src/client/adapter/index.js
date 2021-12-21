import append from 'ramda/src/append.js';
import chain from 'ramda/src/chain.js';
import compose from 'ramda/src/compose.js';
import concat from 'ramda/src/concat.js';
import evolve from 'ramda/src/evolve.js';
import mapObjIndexed from 'ramda/src/mapObjIndexed.js';
import map from 'ramda/src/map.js';
import path from 'ramda/src/path.js';
import reduce from 'ramda/src/reduce.js';
import client from '../index.js';
import entities, { entityMethods } from '../../entities.js';
import {
  generateFilterTransforms, transformD9Schema, transformLocalEntity,
  transformFetchResponse, transformSendResponse,
} from './transformations.js';

/**
 * @typedef {import('../../json-schema/reference').JsonSchema} JsonSchema
 * @typedef {import('../../model/index').EntitySchemata} EntitySchemata
 * @typedef {import('../../model/index').BundleSchemata} BundleSchemata
 */

const DRUPAL_PAGE_LIMIT = 50;

function parseBundles(filter, validTypes) {
  const bundles = [];
  // The filter must either be an object (logical $and) or an array (logical $or).
  if (Array.isArray(filter) || Array.isArray(filter.$or)) {
    (Array.isArray(filter) ? filter : filter.$or).forEach((f) => {
      parseBundles(f).forEach(({ name, filter: bundleFilter }) => {
        const i = bundles.findIndex(b => b.name === name);
        if (i > -1) {
          // Concat on an empty array to flatten either bundle or both.
          bundles[i].filter = [].concat(bundles[i].filter, bundleFilter);
        } else {
          bundles.push({ name, filter: bundleFilter });
        }
      });
    });
    return bundles;
  }
  if (typeof filter !== 'object') throw new Error(`Invalid filter: ${filter}`);
  const { type, ...rest } = typeof filter.$and === 'object' ? filter.$and : filter;
  if (typeof type === 'string') {
    if (!validTypes.includes(type)) throw new Error(`Invalid type filter: ${type}`);
    bundles.push({ name: type, filter: rest });
  }
  if (Array.isArray(type)) {
    type.forEach((t) => {
      if (!validTypes.includes(t)) throw new Error(`Invalid type filter: ${t}`);
      bundles.push({ name: t, filter: rest });
    });
  }
  if ([undefined, null].includes(type)) {
    validTypes.forEach((t) => {
      bundles.push({ name: t, filter: rest });
    });
  }
  return bundles;
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
 * @param {import('../../model/index').FarmModel} model
 * @param {Object} opts
 * @returns {import('../index.js').FarmClient}
 */
export default function adapter(model, opts) {
  const { host, maxPageLimit = DRUPAL_PAGE_LIMIT, ...rest } = opts;
  const connection = client(host, rest);
  const initSchemata = model.schema.get();
  let filterTransforms = generateFilterTransforms(initSchemata);
  model.schema.on('set', (schemata) => {
    filterTransforms = generateFilterTransforms(schemata);
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
      fetch(entName, type) {
        return connection.schema.fetch(entName, type)
          .then((schemata) => {
            if (!entName) {
              return mapObjIndexed(
                (entitySchemata, entityName) => map(
                  transformD9Schema(entityName),
                  entitySchemata,
                ),
                schemata,
              );
            }
            if (!type) {
              return map(transformD9Schema(entName), schemata);
            }
            return transformD9Schema(entName)(schemata);
          });
      },
    },
    ...entityMethods(({ nomenclature: { name, shortName } }) => ({
      ...connection[shortName],
      fetch: ({ filter, limit }) => {
        const validTypes = Object.keys(model.schema.get(name));
        const bundles = parseBundles(filter, validTypes);
        const bundleRequests = bundles.map(({ name: bundle, filter: bundleFilter }) => {
          const fetchOptions = { filter: bundleFilter, filterTransforms, limit };
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
        data.type,
        transformLocalEntity(name, data),
      ).then(transformSendResponse(name)),
    }), entities),
  };
}
