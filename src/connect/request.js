const { evolve } = require('ramda');

// Utility for appending query params onto an endpoint
const appendParam = (name, value) => endpoint => (
  (endpoint.endsWith('?') && value !== undefined) // eslint-disable-line no-nested-ternary
    ? `${endpoint}${name}=${value}`
    : (value !== undefined)
    ? `${endpoint}&${name}=${value}` // eslint-disable-line indent
    : endpoint // eslint-disable-line indent
);

// Utility for appending an array of query params onto an endpoint
const appendArrayOfParams = (name, arr) => (endpoint) => {
  if (arr !== undefined) {
    return arr.reduce((acc, cur, i) => (
      appendParam(`${name}[${i}]`, cur)(acc)
    ), endpoint);
  }
  return endpoint;
};

module.exports = function farmRequest(client) {
  const request = (endpoint, opts = {}) =>
    client(endpoint, evolve({ data: JSON.stringify }, opts))
      .then(res => res.data)
      .catch((err) => { throw err; });

  // Recursive request for looping through multiple pages
  const requestAll = (url, page = 0, list = []) =>
    request(`${url}&page=${page}`)
      .then((response) => {
        const lastPage = +(new URL(response.last)).searchParams.get('page');
        if (page === lastPage) {
          return { list: list.concat(response.list) };
        }
        const newList = list.concat(response.list);
        return requestAll(url, page + 1, newList);
      })
      .catch((err) => { throw err; });

  // Run requests for arrays in batches, so not to exceed URL length of 2000 chars
  const batchRequest = (name, arr, endpoint, results = []) => {
    if (arr.length <= 100) {
      const query = appendArrayOfParams(name, arr)(endpoint);
      return request(query)
        .then(_res => ({ list: results.concat(_res.list) }))
        .catch((err) => { throw err; });
    }
    const thisBatch = arr.slice(0, 99);
    const nextBatch = arr.slice(99);
    const query = appendArrayOfParams(name, thisBatch)(endpoint);
    return request(query)
      .then(_res => batchRequest(name, nextBatch, endpoint, _res.list))
      .catch((err) => { throw err; });
  };

  return { request, requestAll, batchRequest };
};
