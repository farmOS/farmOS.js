const {
  compose, defaultTo, evolve, prop, bind, chain,
} = require('ramda');
const parseFilter = require('./parseFilter');

module.exports = function farmRequest(client) {
  const request = (endpoint, opts = {}) =>
    client(endpoint, evolve({ data: JSON.stringify }, opts))
      .then(res => res.data)
      .catch((err) => { throw err; });

  const transformBundledParams = (entity, getTypes) => ([bundle, params]) => {
    if (bundle === 'undefined') {
      if (typeof getTypes === 'function') {
        return getTypes(entity).map(t => request(`api/${entity}/${t}?${params}`));
      }
      return Promise.reject(new Error(`Requests must provide a valid ${entity} type.`));
    }
    return request(`api/${entity}/${bundle}?${params}`);
  };

  const makeGet = (entity, getTypes) => compose(
    bind(Promise.all, Promise),
    chain(transformBundledParams(entity, getTypes)),
    Object.entries,
    parseFilter,
    prop('filter'),
    defaultTo({}),
  );

  return { request, makeGet };
};
