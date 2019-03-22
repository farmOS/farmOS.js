import axios from 'axios';

export default function (host, user, password) {
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
    }
    return new Promise((resolve, reject) => {
      axios(url, opts)
        .then(res => resolve(res.data)).catch(reject);
    });
  }

  // Recursive request for looping through multiple pages
  function requestAll(url, page = 0, list = []) {
    return new Promise((resolve, reject) => request(`${url}&page=${page}`)
      .then((response) => {
        const lastPage = +(new URL(response.last)).searchParams.get('page');
        if (page === lastPage) {
          resolve(list.concat(response.list));
          return;
        }
        const newList = list.concat(response.list);
        requestAll(url, page + 1, newList).then(resolve).catch(reject);
      }).catch(reject));
  }

  // Utility for parsing if there's an ID provided, then formatting the params
  const params = id => (id ? `/${id}.json` : '.json');

  // Utility for finding the vid of the farm_assets vocabulary
  const areaVid = vocab => vocab.list
    .find(voc => voc.machine_name === 'farm_areas')
    .vid;

  return {
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
      return request('/user/logout');
    },
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

        // If an option object is passed, set defaults and parse the string params
        const {
          page = null,
          type = [],
          log_owner = '',
          done = '',
        } = opts;

        // Build a querystring based on which params have been passed in the opts object
        let queryString = '/log.json?';
        // First, build all requested types onto the string
        type.forEach((oneType, index) => {
          queryString = (queryString.slice(-1) !== '?') ? `${queryString}&` : queryString;
          queryString = `${queryString}type[${index}]=${oneType}`;
        });
        // Then append other search params
        queryString = (queryString.slice(-1) !== '?' && log_owner !== '') ? `${queryString}&` : queryString; // eslint-disable-line camelcase
        queryString = (log_owner !== '') ? `${queryString}log_owner=${log_owner}` : queryString; // eslint-disable-line camelcase
        queryString = (queryString.slice(-1) !== '?' && page !== null) ? `${queryString}&` : queryString;
        queryString = (page !== null) ? `${queryString}page=${page}` : queryString;
        queryString = (queryString.slice(-1) !== '?' && done !== '') ? `${queryString}&` : queryString;
        queryString = (done !== '') ? `${queryString}done=${done}` : queryString;

        // If no ID is passed but page is passed
        return request(queryString);
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
        if (typeof opts === 'string') {
          return request(`/taxonomy_term.json?bundle=${opts}`);
        }

        const {
          page = null,
          vocabulary = '',
          name = '',
        } = opts;

        const vocabParams = (vocabulary !== '') ? `bundle=${vocabulary}` : '';
        const nameParams = (name !== '') ? `&name=${name}` : '';
        const pageParams = (page !== null) ? `&page=${page}` : '';

        return request(`/taxonomy_term.json?${vocabParams}${nameParams}${pageParams}`);
      },
    },
  };
}
