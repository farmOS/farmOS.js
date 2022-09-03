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
import { parseEntityType } from '../type-to-bundle.js';

/**
 * @typedef {import('../../json-schema/reference').JsonSchema} JsonSchema
 * @typedef {import('../../model/index').EntitySchemata} EntitySchemata
 * @typedef {import('../../model/index').BundleSchemata} BundleSchemata
 */

const DRUPAL_PAGE_LIMIT = 50;

export function parseBundles(filter, validBundles) {
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
  if (typeof filter !== 'object') return bundles;
  const { type, ...rest } = typeof filter.$and === 'object' ? filter.$and : filter;
  if (typeof type === 'string') {
    const { bundle } = parseEntityType(type);
    if (!validBundles.includes(bundle)) return bundles;
    bundles.push({ name: bundle, filter: rest });
  }
  if (Array.isArray(type)) {
    type.forEach((t) => {
      const { bundle } = parseEntityType(t);
      if (validBundles.includes(bundle)) {
        bundles.push({ name: bundle, filter: rest });
      }
    });
  }
  if ([undefined, null].includes(type)) {
    validBundles.forEach((b) => {
      bundles.push({ name: b, filter: rest });
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
      fetch: ({ filter, limit }) => {
        const validBundles = Object.keys(model.schema.get(name));
        const bundles = parseBundles(filter, validBundles);
        const bundleRequests = bundles.map(({ name: bundle, filter: bundleFilter }) => {
          const fetchOptions = {
            filter: bundleFilter,
            limit,
          };
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
