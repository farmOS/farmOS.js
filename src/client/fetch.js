import compose from 'ramda/src/compose';
import concat from 'ramda/src/concat';
import defaultTo from 'ramda/src/defaultTo';
import isEmpty from 'ramda/src/isEmpty';
import reduce from 'ramda/src/reduce';
import unless from 'ramda/src/unless';
import parseFilter from './parse-filter.js';

/**
 * @typedef {Object} FetchOptions
 * @property {Object} [filter]
 * @property {Object} [filterTransforms]
 * @property {Number} [limit]
 * @property {Object} [sort]
 */

/**
 * farmOS client method for fetching entities from a Drupal JSON:API server
 * @typedef {Function} fetchEntity
 * @param {String} bundle The bundle type (eg, 'activity', 'equipment', etc).
 * @param {FetchOptions} [options] Options for the fetch request.
 * @returns {Promise}
 */

/** @type {(limit: Number?) => String} */
const parseLimit = limit =>
  (Number.isInteger(limit) && limit > 0 ? `&page[limit]=${limit}` : '');
const concatSortParams = (prev, [path, direction]) =>
  `${prev !== '' ? ',' : ''}${direction === 'DESC' ? '-' : ''}${path}`;
/** @type {(sort: Object?) => String} */
const parseSort = compose(
  unless(isEmpty, concat('&sort=')),
  reduce(concatSortParams, ''),
  Object.entries,
  defaultTo({}),
);

/**
 * @param {FetchOptions} options
 * @returns {String}
 */
export function parseFetchParams(options = {}) {
  const {
    filter, filterTransforms, limit, sort,
  } = options;
  const filterParams = parseFilter(filter, { filterTransforms });
  const limitParams = parseLimit(limit);
  const sortParams = parseSort(sort);
  return filterParams + limitParams + sortParams;
}

/**
 * @param {String} entity
 * @param {Function} request
 * @returns {fetchEntity}
 */
const fetchEntity = (entity, request) => (bundle, options) =>
  request(`/api/${entity}/${bundle}?${parseFetchParams(options)}`);

export default fetchEntity;
