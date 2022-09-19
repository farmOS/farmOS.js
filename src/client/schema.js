import compose from 'ramda/src/compose.js';
import filter from 'ramda/src/filter.js';
import map from 'ramda/src/map.js';
import path from 'ramda/src/path.js';
import { parseEntityType } from '../types.js';

/**
 * Fetch JSON Schema documents for farmOS data structures.
 * @typedef {Function} FetchSchema
 * @param {string} [entity] The farmOS entity for which you wish to retrieve schemata.
 * @param {string} [bundle] The entity bundle for which you wish to retrieve schemata.
 * @returns {Promise<EntitySchemata|BundleSchemata|JsonSchema>}
 */

/**
 * @typedef {import('../entities.js').EntityConfig} EntityConfig
 */

/**
 * @param {import('axios').AxiosInstance} request
 * @param {Object<String, EntityConfig>} entities
 * @returns {FetchSchema}
 */
const fetchSchema = (request, entities) => (...args) => {
  const schemata = map(() => ({}), entities);
  let entity; let bundle;
  const [arg1, arg2] = args;
  if (arg1 && !arg2) {
    ({ entity = arg1, bundle } = parseEntityType(arg1));
  }
  if (arg1 && arg2) {
    ({ entity = arg1, bundle = arg2 } = parseEntityType(arg2));
  }
  const toSchemaRequest = ({ entity: e, bundle: b }) =>
    request(`/api/${e}/${b}/resource/schema`).then(({ data: schema }) => {
      schemata[e][b] = schema;
      return schema;
    });
  if (entity in entities && bundle) {
    return toSchemaRequest({ entity, bundle });
  }
  const mapToSchemaRequests = compose(
    map(toSchemaRequest),
    !entity ? filter(o => o.entity in entities) : filter(o => o.entity === entity),
    map(parseEntityType),
    Object.keys,
    path(['data', 'links']),
  );
  return request('/api/')
    .then(response => Promise.all(mapToSchemaRequests(response)))
    .then(() => {
      if (entity in entities && bundle) return schemata[entity][bundle] || null;
      if (entity in entities) return schemata[entity];
      return schemata;
    });
};

export default fetchSchema;
