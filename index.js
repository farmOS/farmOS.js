const axios = require('axios');
const compose = require('ramda/src/compose');

function farmOS(host, user, password) {
  function request(endpoint, {
    method = 'GET',
    payload = '',
    token = '',
    auth = false,
  } = {}) {
    const url = host + endpoint;
    // Set basic axios options, for a non-auth GET requests
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'json',
      },
      withCredentials: true,
    };
    // Axios options for non-auth POST and PUT requests
    if ((method === 'POST' || method === 'PUT') && !auth) {
      opts.headers['X-CSRF-Token'] = token;
      opts.data = JSON.stringify(payload);
    }
    // Axios options for authentication GET requests
    if (auth) {
      opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
    // Axios options for authentication POST requests
    if (method === 'POST' && auth) {
      opts.data = `name=${payload.name}&pass=${payload.pass}&form_id=${payload.form_id}`; // eslint-disable-line camelcase
      // Accept 30* status codes as valid response w/o redirecting,
      // so we can get the cookie from headers
      opts.maxRedirects = 0;
      opts.validateStatus = status => (status >= 200 && status < 400);
    }
    // In Node, the cookie will be set explicitly, and needs to be added to the header
    if (farm.cookie !== '') { // eslint-disable-line no-use-before-define
      opts.headers.Cookie = farm.cookie; // eslint-disable-line no-use-before-define
    }
    return axios(url, opts)
      .then((res) => {
        // In Node, the cookie needs to be saved manually;
        // browsers will ignore this and store the cookie automagically.
        if (res.headers['set-cookie']) {
          farm.cookie = res.headers['set-cookie'][0]; // eslint-disable-line prefer-destructuring, no-use-before-define
        }
        return res.data;
      }).catch((err) => { throw err; });
  }

  // Recursive request for looping through multiple pages
  function requestAll(url, page = 0, list = []) {
    return request(`${url}&page=${page}`)
      .then((response) => {
        const lastPage = +(new URL(response.last)).searchParams.get('page');
        if (page === lastPage) {
          return { list: list.concat(response.list) };
        }
        const newList = list.concat(response.list);
        return requestAll(url, page + 1, newList);
      })
      .catch(err => err);
  }

  // Utility for parsing if there's an ID provided, then formatting the params
  const params = id => (id ? `/${id}.json` : '.json');

  // Utility for finding the vid of the farm_assets vocabulary
  const areaVid = vocab => vocab.list
    .find(voc => voc.machine_name === 'farm_areas')
    .vid;

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

  // Run requests for arrays in batches, so not to exceed URL length of 2000 chars
  const batchRequest = (name, arr, endpoint, results = []) => {
    if (arr.length <= 100) {
      const query = appendArrayOfParams(name, arr)(endpoint);
      return request(query)
        .then(_res => ({ list: results.concat(_res.list) }))
        .catch(err => err);
    }
    const thisBatch = arr.slice(0, 99);
    const nextBatch = arr.slice(99);
    const query = appendArrayOfParams(name, thisBatch)(endpoint);
    return request(query)
      .then(_res => batchRequest(name, nextBatch, endpoint, _res.list))
      .catch(err => err);
  };

  const farm = {
    authenticate() {
      const payload = {
        form_id: 'user_login',
        name: user,
        pass: password,
      };
      return request('/user/login', { method: 'POST', payload, auth: true })
        .then(() => request('/restws/session/token', { auth: true })
          .then(token => token)
          .catch((error) => { throw error; }))
        .catch((error) => { throw error; });
    },
    logout() {
      this.cookie = '';
      return request('/user/logout');
    },
    cookie: '',
    area: {
      delete(id, token) {
        return request('/taxonomy_vocabulary.json').then(res => (
          request(`/taxonomy_term.json?vocabulary=${areaVid(res)}${params(id)}`, { method: 'DELETE', token })
        ));
      },
      get(opts = {}) {
        return request('/taxonomy_vocabulary.json').then((res) => {
          // If an ID # is passed instead of an options object
          if (typeof opts === 'number') {
            return request(`/taxonomy_term.json?vocabulary=${areaVid(res)}&tid=${opts}`);
          }

          // If an option object is passed, set defaults and parse the string params
          const { page = null, type = '' } = opts;
          const typeParams = (type !== '') ? `area_type=${type}` : '';
          const pageParams = (page !== null) ? `page=${page}` : '';

          // If no page # is passed, get all of them
          if (page === null) {
            return requestAll(`/taxonomy_term.json?vocabulary=${areaVid(res)}&${typeParams}`);
          }

          // If no ID is passed but page is passed
          return request(`/taxonomy_term.json?vocabulary=${areaVid(res)}&${typeParams}&${pageParams}`);
        });
      },
      send(payload, id, token) {
        return request('/taxonomy_vocabulary.json').then(res => (
          request(`/taxonomy_term.json?vocabulary=${areaVid(res)}${params(id)}`, { method: 'POST', payload, token })
        ));
      },
    },
    asset: {
      delete(id, token) {
        return request(`/farm_asset/${id}.json`, { method: 'DELETE', token });
      },
      get(opts = {}) {
        // If an ID # is passed instead of an options object
        if (typeof opts === 'number') {
          return request(`/farm_asset/${opts}.json`);
        }

        // If an option object is passed, set defaults and parse the string params
        const {
          type = '',
          archived = false,
          page = null,
        } = opts;
        const typeParams = (type !== '') ? `type=${type}` : '';
        const archiveParams = (archived) ? '' : '&archived=0';
        const pageParams = (page !== null) ? `&page=${page}` : '';

        // If no page # is passed, get all of them
        if (page === null) {
          return requestAll(`/farm_asset.json?${typeParams}${archiveParams}`);
        }

        // If no ID is passed but page is passed
        return request(`/farm_asset.json?${typeParams}${archiveParams}${pageParams}`);
      },
      send(payload, id, token) {
        return request(`/farm_asset${params(id)}`, { method: 'POST', payload, token });
      },
    },
    info() {
      // Returns a json with {name: , url: , user: {uid: , name: , mail: }}
      return request('/farm.json');
    },
    log: {
      delete(id, token) {
        return request(`/log/${id}.json`, { method: 'DELETE', token });
      },
      get(opts = {}) {
        // If an ID # is passed instead of an options object
        if (typeof opts === 'number') {
          return request(`/log/${opts}.json`);
        }

        // If an array of id's are passed in
        if (Array.isArray(opts) && opts.length > 0) {
          return batchRequest('id', opts, '/log.json?');
        }

        const {
          page,
          type,
          log_owner, // eslint-disable-line camelcase
          done,
        } = opts;

        // Build the query string...
        const query = compose(
          appendParam('log_owner', log_owner),
          appendParam('done', done),
          appendArrayOfParams('type', type),
        )('/log.json?');

        // Append the page # if supplied and use paginated request...
        if (page !== undefined) {
          return compose(
            request,
            appendParam('page', page),
          )(query);
        }
        // Otherwise request all pages
        return requestAll(query);
      },
      send(payload, token) {
        if (payload.id) {
          return request(`/log/${payload.id}`, { method: 'PUT', payload, token })
            // Add properties back to response so it mirrors a POST response
            .then(res => ({
              ...res,
              id: payload.id,
              uri: payload.uri,
              resource: 'log',
            }));
        }
        return request('/log', { method: 'POST', payload, token });
      },
    },
    term: {
      get(opts = {}) {
        // If a taxonomy machine name is passed in, just return the bundle
        if (typeof opts === 'string') {
          return requestAll(`/taxonomy_term.json?bundle=${opts}`);
        }

        const {
          page,
          vocabulary,
          name,
        } = opts;

        // Build the url and query params...
        const query = compose(
          appendParam('vocabulary', vocabulary),
          appendParam('name', name),
        )('/taxonomy_term.json?');

        // If no page param is given, request all pages for the given params
        if (page === undefined) {
          return requestAll(query);
        }

        // Otherwise submit the request with page parameters
        return compose(
          request,
          appendParam('page', page),
        )(query);
      },
      send(payload, token) {
        if (payload.tid) {
          return request(`/taxonomy_term/${payload.tid}`, { method: 'PUT', payload, token });
        }
        return request('/taxonomy_term', { method: 'POST', payload, token });
      },
    },
    vocabulary(machineName) {
      if (machineName === undefined) {
        return request('/taxonomy_vocabulary.json');
      }
      return request(`/taxonomy_vocabulary.json?machine_name=${machineName}`);
    },
  };
  return farm;
}

module.exports = farmOS;
