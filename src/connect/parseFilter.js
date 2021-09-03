function mergeParams(p1, p2) {
  const params = new URLSearchParams(p1);
  new URLSearchParams(p2).forEach((val, key) => {
    params.append(key, val);
  });
  return params.toString();
}

const logical = {
  $and: 'AND',
  $or: 'OR',
};
const comparison = {
  $eq: '%3D',
  $ne: '<>',
  $gt: '>',
  $gte: '>=',
  $lt: '<',
  $lte: '<=',
};

function parseComparison(path, expr, group = null, i = 0) {
  const [[op, val], ...tail] = Object.entries(expr);
  const urlEncodedOp = comparison[op];
  if (!urlEncodedOp) throw new Error(`Invalid comparison operator: ${op}`);
  const pathStr = `&filter[${path}-${i}-filter][condition][path]=${path}`;
  const opStr = `&filter[${path}-${i}-filter][condition][operator]=${urlEncodedOp}`;
  const valStr = `&filter[${path}-${i}-filter][condition][value]=${val}`;
  const membership = group ? `&filter[${path}-${i}-filter][condition][memberOf]=${group}` : '';
  const str = pathStr + opStr + valStr + membership;
  if (tail.length === 0) return str;
  const nextExpr = Object.fromEntries(tail);
  return str + parseComparison(path, nextExpr, group, i + 1);
}

function parseLogic(op, filters, group, depth) {
  const label = `group-${depth}`;
  const conjunction = `&filter[${label}][group][conjunction]=${logical[op]}`;
  const membership = group ? `&filter[${label}][condition][memberOf]=${group}` : '';
  return filters.reduce(
    // eslint-disable-next-line no-use-before-define
    (params, filter) => mergeParams(params, parseFilter(filter, label, depth + 1)),
    conjunction + membership,
  );
}

function parseField(path, val, group, depth) {
  const membership = group ? `&filter[${path}-filter][condition][memberOf]=${group}` : '';
  if (typeof val !== 'object') {
    const pathStr = `filter[${path}-filter][condition][path]=${path}`;
    const opStr = `&filter[${path}-filter][condition][operator]=%3D`;
    const valStr = `&filter[${path}-filter][condition][value]=${val}`;
    return pathStr + opStr + valStr + membership;
  }
  if (val === null) {
    const pathStr = `&filter[${path}-filter][condition][path]=${path}`;
    const opStr = `&filter[${path}-filter][condition][operator]=IS%20NULL`;
    return pathStr + opStr + membership;
  }
  if (Array.isArray(val) || '$or' in val) {
    const filters = Array.isArray(val) ? val : val.$or;
    if (!Array.isArray(filters)) {
      throw new Error(`The value of \`${path}.$or\` must be an array. `
      + `Invalid constructor: ${filters.constructor.name}`);
    }
    return parseLogic('$or', filters, group, depth + 1);
  }
  if ('$and' in val) {
    if (!Array.isArray(val.$and)) {
      throw new Error(`The value of \`${path}.$and\` must be an array. `
      + `Invalid constructor: ${val.$and.constructor.name}`);
    }
    return parseLogic('$and', val.$and, group, depth + 1);
  }
  // Otherwise we assume all properties in val are comparison operators;
  // parseComparison will throw if any property is NOT a comparison operator.
  return parseComparison(path, val, group);
}

function parseFilter(filter, group, depth = 0) {
  if (Array.isArray(filter)) {
    return parseLogic('$or', filter, group, depth);
  }
  let params = '';
  const entries = Object.entries(filter);
  if (entries.length === 0) return params;
  const [[key, val], ...rest] = entries;
  if (['$and', '$or'].includes(key)) {
    params = parseLogic(key, val, group, depth);
  }
  if (key && val !== undefined) {
    params = parseField(key, val, group, depth);
  }
  if (rest.length === 0) return params;
  const tailParams = parseFilter(Object.fromEntries(rest));
  return mergeParams(params, tailParams);
}

module.exports = parseFilter;
