const {
  compose, defaultTo, prop, bind, chain, has, ifElse,
} = require('ramda');
const parseFilter = require('./parseFilter');
const { typeToBundle } = require('../utils');

module.exports = function farmRequest(client) {
  const request = (endpoint, { method = 'GET', ...data } = {}) =>
    client(endpoint, { method, data: JSON.stringify(data) })
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

  const errorIs404 = e => +e.response.status === 404;

  const handlePatch404 = (entity, data) => ifElse(
    errorIs404,
    () => sendRequest(entity, 'POST')(data), // eslint-disable-line no-use-before-define
    Promise.reject,
  );

  const sendRequest = (entity, method) => (data) => {
    if (method === 'POST') {
      return request(
        `api/${entity}/${typeToBundle(entity, data.type)}`,
        { method, data },
      );
    }
    return request(
      `api/${entity}/${typeToBundle(entity, data.type)}/${data.id}`,
      { method, data },
    ).catch(handlePatch404(entity, data));
  };

  const sendPostOrPatch = entity => ifElse(
    has('id'),
    sendRequest(entity, 'PATCH'),
    sendRequest(entity, 'POST'),
  );

  const makeSend = (entity, validate) => (data) => {
    const { valid = true, errors = [] } = typeof validate === 'function'
      && validate(entity, data);
    if (valid) {
      return sendPostOrPatch(entity)(data);
    }
    return Promise.reject(errors);
  };

  return { request, makeGet, makeSend };
};
