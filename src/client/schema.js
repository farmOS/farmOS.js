import map from 'ramda/src/map.js';
import prop from 'ramda/src/prop.js';
import typeToBundle from './typeToBundle.js';
import entities from '../entities.js';

/**
 * Fetch JSON Schema documents for farmOS data structures.
 * @typedef {Function} FetchSchema
 * @param {string} [entity] The farmOS entity for which you wish to retrieve schemata.
 * @param {string} [bundle] The entity bundle for which you wish to retrieve schemata.
 * @returns {Promise<EntitySchemata|BundleSchemata|JsonSchema>}
 */
/**
 * @param {import('axios').AxiosInstance} request
 * @returns {FetchSchema}
 */
const fetchSchema = request => (entity, bundle) => {
  if (!entity) {
    const schemata = map(() => ({}), entities);
    return request('/api/')
      .then(res => Promise.all(Object.keys(res.data.links)
        .filter(type => Object.keys(entities)
          .some(name => type.startsWith(`${name}--`)))
        .map((type) => {
          const [entName, b] = type.split('--');
          return request(`/api/${entName}/${b}/resource/schema`)
            .then(({ data: schema }) => { schemata[entName][b] = schema; });
        })))
      .then(() => schemata);
  }
  if (!bundle) {
    return request('/api/')
      .then(res => Promise.all(Object.keys(res.data.links)
        .filter(type => type.startsWith(`${entity}--`))
        .map((type) => {
          const b = typeToBundle(entity, type);
          return request(`/api/${entity}/${b}/resource/schema`)
            .then(({ data: schema }) => [b, schema]);
        }))
        .then(Object.fromEntries));
  }
  return request(`/api/${entity}/${bundle}/resource/schema`)
    .then(prop('data'));
};

export default fetchSchema;
