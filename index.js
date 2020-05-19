const axios = require('axios');
const compose = require('ramda/src/compose');

function farmOS(host, clientId = 'farm', tokenUpdater = null) {
  const oauthCredentials = {
    clientId,
    accessTokenUri: '/oauth2/token',
  }

  // Instantiate axios client.
  const clientOptions = {
    baseURL: host,
    headers: {
      'Content-Type': 'application/json',
      Accept: `json`,
    },
  };
  const client = axios.create(clientOptions);

  // Keep track if the OAuth token is being refreshed.
  let isRefreshing = false;

  // Array of callbacks to call once token is refreshed.
  let subscribers = [];

  // Add to array of callbacks.
  function subscribeTokenRefresh(cb) {
    subscribers.push(cb);
  }

  // Call all subscribers. 
  function onRefreshed(token) {
    subscribers.map(cb => cb(token));
  }

  // Helper function to refresh OAuth2 token.
  function refreshToken(refreshToken) {
    isRefreshing = true;
    const opts = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'json',
      },
      data: {
        grant_type: 'refresh_token',
        client_id: oauthCredentials.clientId,
        refresh_token: refreshToken,
      }
    };
    return axios(host + oauthCredentials.accessTokenUri, opts)
      .then((res) => {
        const token = farm.useToken(res.data);
        isRefreshing = false;
        onRefreshed(token.access_token);
        subscribers = [];
        return token;
      })
      .catch((error) => { 
        subscribers = [];
        isRefreshing = false;
        throw error;
      });
  }

  // Helper function to get an OAuth access token.
  // This will attempt to refresh the token if needed.
  // Returns a Promise that resvoles as the access token.
  function getAccessToken(token) {
    if (token == null || token.access_token == null || token.expires == null) {
      throw new Error('client must be authorized before making requests.');
    }

    // Wait for new access token if currently refreshing.
    if (isRefreshing) {
      const requestSubscribers = new Promise(resolve => {
        subscribeTokenRefresh(token => {
          resolve(token);
        });
      });
      return requestSubscribers;
    }

    // Refresh if token expired.
    // - 1000 ms to factor for tokens that might expire while in flight.
    if (!isRefreshing && token.expires - 1000 < Date.now()) {
      return refreshToken(token.refresh_token).then(token => token.access_token);
    }

    // Else return the current access token.
    return Promise.resolve(token.access_token);
  };

  // Add axios request interceptor to the client.
  // This adds the Authorization Bearer token header.
  client.interceptors.request.use((config) => {
    // Only add access token to header.
    return getAccessToken(farm.token).then(accessToken => {
      config.headers.Authorization = `Bearer ${accessToken}`;
      return Promise.resolve(config);
    }).catch(error => { throw error; })
  }, (error) => {
    return Promise.reject(error);
  });

  // Add axios response interceptor to the client.
  // This tries to resolve 403 errors due to expired tokens.
  client.interceptors.response.use(undefined, err => {
    const { config } = err;
    const originalRequest = config;

    if ( err.response && err.response.status === 403) {
      // Refresh the token and retry.
      if (!isRefreshing) {
        isRefreshing = true;
        return refreshToken(farm.token.refresh_token).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token.access_token}`;
          return axios(originalRequest);
        });
      }
      // Else subscribe for new access token after refresh.
      const requestSubscribers = new Promise(resolve => {
        subscribeTokenRefresh(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(axios(originalRequest));
        });
      });
      return requestSubscribers;
    }
    return Promise.reject(err);
  });

  function request(endpoint, {
    method = 'GET',
    payload = '',
  } = {}) {
    // Set request method. 
    const opts = {
      method,
    };
    // Axios options for non-auth POST and PUT requests
    if (method === 'POST' || method === 'PUT') {
      opts.data = JSON.stringify(payload);
    }
    // Return the request.
    return client(endpoint, opts)
      .then((res) => {
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
      .catch((err) => { throw err; });
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
        .catch((err) => { throw err; });
    }
    const thisBatch = arr.slice(0, 99);
    const nextBatch = arr.slice(99);
    const query = appendArrayOfParams(name, thisBatch)(endpoint);
    return request(query)
      .then(_res => batchRequest(name, nextBatch, endpoint, _res.list))
      .catch((err) => { throw err; });
  };

  const farm = {
    // Specify an existing OAuth token to use.
    useToken(token) {
      // Build new token.
      farm.token = token;

      // Calculate new expiration time.
      if (!token.expires) {
        farm.token.expires = Date.now() + token.expires_in * 1000;
      }

      // Call tokenUpdater if provided.
      if (tokenUpdater != null) {
        tokenUpdater(farm.token);
      }
      return farm.token;
    },
    // Authorize with username and password.
    authorize(user, password, scope = 'user_access') {
      if (user != null && password != null) {
        const tokenConfig = {
          username: user,
          password: password,
          scope,
        };
        // Build opts for oauth2 password grant.
        const opts = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'json',
          },
          data: {
            grant_type: 'password',
            client_id: oauthCredentials.clientId,
            scope: scope,
            username: user,
            password: password,
          }
        };
        return axios(host + oauthCredentials.accessTokenUri, opts)
          .then((res) => {
            return farm.useToken(res.data);
          })
          .catch((error) => { throw error; });
      }
    },
    logout() {
      // TODO: This library doesn't support OAuth2 Revoke.
      farm.token = null;
      return Promise.resolve();
    },
    token: null,
    area: {
      delete(id) {
        return request('/taxonomy_vocabulary.json').then(res => (
          request(`/taxonomy_term.json?vocabulary=${areaVid(res)}${params(id)}`, { method: 'DELETE' })
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
      send(payload, id) {
        return request('/taxonomy_vocabulary.json').then(res => (
          request(`/taxonomy_term.json?vocabulary=${areaVid(res)}${params(id)}`, { method: 'POST', payload })
        ));
      },
    },
    asset: {
      delete(id) {
        return request(`/farm_asset/${id}.json`, { method: 'DELETE' });
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
      send(payload, id) {
        return request(`/farm_asset${params(id)}`, { method: 'POST', payload });
      },
    },
    info() {
      // Returns a json with {name: , url: , user: {uid: , name: , mail: }}
      return request('/farm.json');
    },
    log: {
      delete(id) {
        return request(`/log/${id}.json`, { method: 'DELETE' });
      },
      get(opts = {}) {
        // If an ID # is passed instead of an options object
        if (typeof opts === 'number') {
          return request(`/log/${opts}.json`);
        }

        // If an array of id's are passed in
        if (Array.isArray(opts)) {
          return opts.length > 0
            ? batchRequest('id', opts, '/log.json?')
            : { list: [] };
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
      send(payload) {
        if (payload.id) {
          return request(`/log/${payload.id}`, { method: 'PUT', payload })
            // Add properties back to response so it mirrors a POST response
            .then(res => ({
              ...res,
              id: payload.id,
              uri: `${host}/log/${payload.id}`,
              resource: 'log',
            }));
        }
        return request('/log', { method: 'POST', payload });
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
      send(payload) {
        if (payload.tid) {
          return request(`/taxonomy_term/${payload.tid}`, { method: 'PUT', payload });
        }
        return request('/taxonomy_term', { method: 'POST', payload });
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
