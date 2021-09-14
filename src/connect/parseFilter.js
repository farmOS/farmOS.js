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

module.exports = (filterTransforms = {}) =>
  function parseFilter(filter, group, depth = 0) {
    function parseComparison(path, expr, comGroup = null, i = 0) {
      const amp = i > 0 ? '&' : '';
      const membership = comGroup ? `&filter[${path}-${i}-filter][condition][memberOf]=${comGroup}` : '';
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
      const pathStr = `${amp}filter[${path}-${i}-filter][condition][path]=${path}`;
      const opStr = `&filter[${path}-${i}-filter][condition][operator]=${urlEncodedOp}`;
      const valStr = `&filter[${path}-${i}-filter][condition][value]=${val}`;
      const str = pathStr + opStr + valStr + membership;
      if (tail.length === 0) return str;
      const nextExpr = Object.fromEntries(tail);
      return str + parseComparison(path, nextExpr, comGroup, i + 1);
    }

    function parseLogic(op, filters, logicGroup, logicDepth) {
      const label = `group-${logicDepth}`;
      const conjunction = `&filter[${label}][group][conjunction]=${logical[op]}`;
      const membership = logicGroup ? `&filter[${label}][condition][memberOf]=${logicGroup}` : '';
      return filters.reduce(
        (params, f) => mergeParams(params, parseFilter(f, label, logicDepth + 1)),
        conjunction + membership,
      );
    }

    function parseField(path, val, fieldGroup, fieldDepth) {
      if (['string', 'number', 'boolean'].includes(typeof val) || val === null) {
        return parseComparison(path, { $eq: val }, fieldGroup);
      }
      if (Array.isArray(val) || '$or' in val) {
        const filters = Array.isArray(val) ? val : val.$or;
        if (!Array.isArray(filters)) {
          throw new Error(`The value of \`${path}.$or\` must be an array. `
          + `Invalid constructor: ${filters.constructor.name}`);
        }
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
  };
