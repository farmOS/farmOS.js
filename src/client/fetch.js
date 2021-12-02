import parseFilter from './parseFilter.js';

/**
 * farmOS client method for fetching entities from a Drupal JSON:API server
 * @typedef {Function} fetchEntity
 * @param {String} bundle The bundle type (eg, 'activity', 'equipment', etc).
 * @param {Object} [options] Options for the fetch request.
 * @property {Object} [options.filter]
 * @property {Object} [options.filterTransforms]
 * @property {Object} [options.limit]
 * @returns {Promise}
 */

/** @type {(limit: Number?) => String} */
const parseLimit = limit =>
  (Number.isInteger(limit) && limit > 0 ? `&page[limit]=${limit}` : '');
/**
 * @param {Object} [options]
 * @property {Object} [options.filter]
 * @property {Object} [options.filterTransforms]
 * @property {Object} [options.limit]
 * @returns {String}
 */
const parseFetchParams = ({ filter = {}, filterTransforms, limit } = {}) =>
  parseFilter(filter, { filterTransforms }) + parseLimit(limit);

/**
 * @param {String} entity
 * @param {Function} request
 * @returns {fetchEntity}
 */
const fetchEntity = (entity, request) => (bundle, options) =>
  request(`/api/${entity}/${bundle}?${parseFetchParams(options)}`);

export default fetchEntity;
