import compose from 'ramda/src/compose';
import match from 'ramda/src/match';

/**
 * @type {RegExp} Identifies valid format for an entity type (eg 'log--activity)
 * and groups matches by type, entity & bundle.
 */
export const entityTypeRegEx = /(\w+)--(\w+)/;
/**
 * @type {Function} Validates a string as an entity type and parses it.
 * @param {String} type A possible entity type (eg, 'log--activity').
 * @returns {{ type?: String, entity?: String, bundle?: String }}
 *  */
export const parseEntityType = compose(
  ([type, entity, bundle]) => ({ type, entity, bundle }),
  match(entityTypeRegEx),
);
/**
 * @type {(fields?: Object) => Object} Takes any object containing entity data,
 * such as props or fields, then normalizes the type, bundle & field.
 * @param {{ type?: String, entity?: String, bundle?: string }} fields
 * @returns {{ type?: String, entity?: String, bundle?: String }}
 */
export function parseTypeFromFields(fields = {}) {
  let { entity, bundle, type } = fields;
  if (type) ({ entity, bundle } = parseEntityType(type));
  if (!type && entity && bundle) type = `${entity}--${bundle}`;
  return { entity, bundle, type };
}

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
        const tMatch = filtersByType.find(fbt => fbt.type === tFilter.type);
        // If so, combine them into a single object w/ an array of filters.
        if (tMatch) {
          // The matching filter, the current filter, or both can be arrays,
          // so concat onto an empty array to flatten them and reassign it.
          tMatch.filter = [].concat(tMatch.filter, tFilter);
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
