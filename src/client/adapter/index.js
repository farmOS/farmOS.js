import compose from 'ramda/src/compose.js';
import rFilter from 'ramda/src/filter.js';
import is from 'ramda/src/is';
import map from 'ramda/src/map.js';
import path from 'ramda/src/path.js';
import client from '../index.js';
import defaultEntities, { entityMethods } from '../../entities.js';
import { parseEntityType, parseTypeFromFields, splitFilterByType } from '../../types.js';
import {
  generateFieldTransforms, transformD9Schema, transformLocalEntity,
  transformFetchResponse, transformSendResponse,
} from './transformations.js';
import { altogether } from '../../utils.js';
import withSubrequests from '../subrequest.js';

/**
 * @typedef {import('../../utils').AltogetherResult} AltogetherResult
 * @typedef {import('../../json-schema/reference').JsonSchema} JsonSchema
 * @typedef {import('../../model/index').EntitySchemata} EntitySchemata
 * @typedef {import('../../model/index').BundleSchemata} BundleSchemata
 */

/**
 * Fetch JSON Schema documents for farmOS data structures.
 * @typedef {Function} FetchSchema
 * @param {string} [entity] The farmOS entity for which you wish to retrieve schemata.
 * @param {string} [bundle] The entity bundle for which you wish to retrieve schemata.
 * @returns {Promise<AltogetherResult<JsonSchema|EntitySchemata|BundleSchemata>>}
 */

const DRUPAL_PAGE_LIMIT = 50;

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

  const fetchAndSetSchemata = ({ entity, bundle }) =>
    connection.schema.fetch(entity, bundle).then((response) => {
      const { data: d9Schema } = response;
      const schema = transformD9Schema(d9Schema);
      model.schema.set(entity, bundle, schema);
      return response;
    });

  const sendWithSubrequest = withSubrequests(model, connection);

  return {
    ...connection,
    schema: {
      /** @type {FetchSchema} */
      fetch(...args) {
        let entity; let bundle;
        const [arg1, arg2] = args;
        if (arg1 && !arg2) {
          ({ entity = arg1, bundle } = parseEntityType(arg1));
        }
        if (arg1 && arg2) {
          ({ entity = arg1, bundle = arg2 } = parseEntityType(arg2));
        }
        if (entity in entities && bundle) {
          return fetchAndSetSchemata({ entity, bundle }).then(response => ({
            data: model.schema.get(entity, bundle),
            fulfilled: [response],
            rejected: [],
          })).catch(response => ({
            data: null,
            fulfilled: [],
            rejected: [response],
          }));
        }
        const transformSchemaResults = (_, data) => (data === null
          ? model.schema.get(entity, bundle)
          : data);
        const aggregateSchemaRequests = compose(
          altogether(transformSchemaResults, null),
          map(fetchAndSetSchemata),
          !entity ? rFilter(o => o.entity in entities) : rFilter(o => o.entity === entity),
          map(parseEntityType),
          Object.keys,
          path(['data', 'links']),
        );
        return connection.request('/api/').then(aggregateSchemaRequests);
      },
    },
    ...entityMethods(({ nomenclature: { name, shortName } }) => ({
      ...connection[shortName],
      /** @type {(options: import('../fetch.js').FetchOptions) => Promise} */
      fetch: (options) => {
        const {
          filter, include, limit, sort,
        } = options;
        const validTypes = Object.keys(model.schema.get(name)).map(b => `${name}--${b}`);
        const bundleRequests = splitFilterByType(filter, validTypes).map((f) => {
          const { type, ...tFilter } = f;
          /** @type {import('../fetch.js').FetchOptions} */
          const fetchOptions = {
            ...tFilter, include, limit, sort,
          };
          const { bundle } = parseEntityType(type);
          if (name in fieldTransforms && bundle in fieldTransforms[name]) {
            fetchOptions.filterTransforms = fieldTransforms[name][bundle];
          }
          const req = connection[shortName].fetch(bundle, fetchOptions);
          return chainRequests(req, limit);
        });
        const concatBundle = (response, data) => {
          const bundle = response.flatMap(path(['data', 'data']));
          const included = response.flatMap(path(['data', 'included']));
          return data.concat(bundle).concat(included).filter(o => !!o);
        };
        return altogether(concatBundle, [], bundleRequests)
          .then(transformFetchResponse);
      },
      send(entity, options) {
        const hasSubrequest = options && is(Object, options.subrequest);
        if (hasSubrequest || is(Array, entity)) {
          return sendWithSubrequest(entity, options);
        }
        const { bundle } = parseTypeFromFields(entity);
        const data = transformLocalEntity(entity, fieldTransforms);
        return connection[shortName].send(bundle, data, options)
          .then(transformSendResponse);
      },
    }), entities),
  };
}
