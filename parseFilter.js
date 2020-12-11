const { compose, chain, map } = require('ramda');

const mergeParams = compose(
  p => (new URLSearchParams(p).toString()),
  chain(Array.from),
  map(p => (new URLSearchParams(p))),
  (...paramsList) => paramsList,
);
const mergeBundledParams = (params1, params2) => {
  const mergedParams = { ...params1 };
  const entries = Object.entries(params2);
  entries.forEach(([key, val]) => {
    mergedParams[key] = mergeParams(val, mergedParams[key]);
  });
  return mergedParams;
};

function parseOp(op) {
  const opMap = {
    $and: 'AND',
    $or: 'OR',
    $eq: '%3D',
    $ne: '<>',
    $gt: '>',
    $gte: '>=',
    $lt: '<',
    $lte: '<=',
  };
  return opMap[op];
}

function parseComparison(path, expr, group = null, i = 0) {
  const entries = Object.entries(expr);
  const [op, val] = entries[0];
  const tail = entries.slice(1);
  const pathStr = `&filter[${path}-${i}-filter][condition][path]=${path}`;
  const opStr = `&filter[${path}-${i}-filter][condition][operator]=${parseOp(op)}`;
  const valStr = `&filter[${path}-${i}-filter][condition][value]=${val}`;
  const membership = group ? `&filter[${path}-${i}-filter][condition][memberOf]=${group}` : '';
  const str = pathStr + opStr + valStr + membership;
  if (tail.length === 0) {
    return str;
  }
  const nextExpr = Object.fromEntries(tail);
  return str + parseComparison(path, nextExpr, group, i + 1);
}

function parseField(path, val, group, bundle) {
  const membership = group ? `&filter[${path}-filter][condition][memberOf]=${group}` : '';
  if (val === null) {
    const pathStr = `&filter[${path}-filter][condition][path]=${path}`;
    const opStr = `&filter[${path}-filter][condition][operator]=IS%20NULL`;
    return { [bundle]: pathStr + opStr + membership };
  }
  if (typeof val === 'object') {
    return { [bundle]: parseComparison(path, val, group) };
  }
  const pathStr = `filter[${path}-filter][condition][path]=${path}`;
  const opStr = `&filter[${path}-filter][condition][operator]=%3D`;
  const valStr = `&filter[${path}-filter][condition][value]=${val}`;
  return { [bundle]: pathStr + opStr + valStr + membership };
}

function parseLogic(op, filters, group, depth, bundle) {
  let label; let initParams = {};
  // If no bundle has been defined, there is no need to create a new group.
  if (bundle) {
    label = `group-${depth}`;
    const conjunction = `&filter[${label}][group][conjunction]=${parseOp(op)}`;
    const membership = group ? `&filter[${label}][condition][memberOf]=${group}` : '';
    initParams = { [bundle]: conjunction + membership };
  }
  return filters.reduce((params, filter) => (
    mergeBundledParams(params, parseFilter(filter, label, depth + 1)) // eslint-disable-line no-use-before-define, max-len
  ), initParams);
}

function parseFilter(filter, group, depth = 0) {
  // Separate the type b/c it will become the bundle; the rest of the key/val
  // pairs will become filter query params.
  const { type, ...rest } = filter;
  let bundledParams = {};

  // Parse the first set of key/val pairs.
  const entries = Object.entries(rest);
  const [key, val] = entries[0] || [undefined, undefined];
  const tailFilters = entries.slice(1);

  if (['$and', '$or'].includes(key)) {
    bundledParams = parseLogic(key, val, group, depth, type);
  } else if (!['undefined', undefined].includes(key)) {
    bundledParams = parseField(key, val, group, type);
  } else {
    bundledParams = { [type]: '' };
  }

  // Early return if we're on the last or only key/val pair.
  if (tailFilters.length === 0) {
    return bundledParams;
  }

  // Otherwise, recurse over the remaining pairs and concatenate the results,
  // batching them by bundle.
  const tailBundledParams = parseFilter(Object.fromEntries(tailFilters));
  return mergeBundledParams(bundledParams, tailBundledParams);
}

module.exports = parseFilter;
