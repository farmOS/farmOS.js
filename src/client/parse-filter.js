function mergeParams(p1, p2) {
  const params = new URLSearchParams(p1);
  new URLSearchParams(p2).forEach((val, key) => {
    params.append(key, val);
  });
  return params.toString();
}

// Helper for determining if a value is a primitive data structure
const isPrim = val =>
  ['string', 'number', 'boolean'].includes(typeof val) || val === null;

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
  $in: 'IN',
  $nin: 'NOT%20IN',
};

export default function parseFilter(filter, options = {}) {
  const { filterTransforms = {} } = options;

  function parseComparison(path, expr, comGroup = null, index = 0) {
    const amp = index > 0 ? '&' : '';
    const pre = `filter[${path}-${index}-filter][condition]`;
    const membership = comGroup ? `&${pre}[memberOf]=${comGroup}` : '';
    const [[op, rawValue], ...tail] = Object.entries(expr);
    const val = typeof filterTransforms[path] === 'function'
      ? filterTransforms[path](rawValue)
      : rawValue;
    if (val === null) {
      const pathStr = `${amp}filter[${path}-filter][condition][path]=${path}`;
      const opStr = `&filter[${path}-filter][condition][operator]=IS%20NULL`;
      return pathStr + opStr + membership;
    }
    const urlEncodedOp = comparison[op];
    if (!urlEncodedOp) throw new Error(`Invalid comparison operator: ${op}`);
    const pathStr = `${amp}${pre}[path]=${path}`;
    const opStr = `&${pre}[operator]=${urlEncodedOp}`;
    const valStr = Array.isArray(val)
      ? val.reduce((substr, v, i) => `${substr}&${pre}[value][${i}]=${v}`, '')
      : `&${pre}[value]=${val}`;
    const str = pathStr + opStr + valStr + membership;
    if (tail.length === 0) return str;
    const nextExpr = Object.fromEntries(tail);
    return str + parseComparison(path, nextExpr, comGroup, index + 1);
  }

  function parseLogic(op, filters, logicGroup, logicDepth) {
    const label = `group-${logicDepth}`;
    const conjunction = `&filter[${label}][group][conjunction]=${logical[op]}`;
    const membership = logicGroup ? `&filter[${label}][condition][memberOf]=${logicGroup}` : '';
    return filters.reduce(
      // eslint-disable-next-line no-use-before-define
      (params, f) => mergeParams(params, parser(f, label, logicDepth + 1)),
      conjunction + membership,
    );
  }

  function parseField(path, val, fieldGroup, fieldDepth) {
    if (isPrim(val)) {
      return parseComparison(path, { $eq: val }, fieldGroup);
    }
    if (Array.isArray(val) || '$or' in val) {
      const arr = Array.isArray(val) ? val : val.$or;
      if (!Array.isArray(arr)) {
        throw new Error(`The value of \`${path}.$or\` must be an array. `
        + `Invalid constructor: ${arr.constructor.name}`);
      }
      const filters = arr.map(v => (isPrim(v) ? { [path]: v } : v));
      return parseLogic('$or', filters, fieldGroup, fieldDepth + 1);
    }
    if ('$and' in val) {
      if (!Array.isArray(val.$and)) {
        throw new Error(`The value of \`${path}.$and\` must be an array. `
        + `Invalid constructor: ${val.$and.constructor.name}`);
      }
      return parseLogic('$and', val.$and, fieldGroup, fieldDepth + 1);
    }
    // Otherwise we assume val is an object and all its properties are comparison
    // operators; parseComparison will throw if any property is NOT a comp op.
    return parseComparison(path, val, fieldGroup);
  }

  const parser = (_filter, group, depth = 0) => {
    if (Array.isArray(_filter)) {
      return parseLogic('$or', _filter, group, depth);
    }
    let params = '';
    const entries = Object.entries(_filter);
    if (entries.length === 0) return params;
    const [[key, val], ...rest] = entries;
    if (['$and', '$or'].includes(key)) {
      params = parseLogic(key, val, group, depth);
    }
    if (key && val !== undefined) {
      params = parseField(key, val, group, depth);
    }
    if (rest.length === 0) return params;
    const tailParams = parser(Object.fromEntries(rest));
    return mergeParams(params, tailParams);
  };

  return parser(filter);
}
