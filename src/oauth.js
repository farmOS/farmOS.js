const axios = require('axios');

module.exports = function oAuth(client, opts) {
  let memToken = {};
  const {
    host,
    clientId = 'farm',
    getToken = () => memToken,
    setToken = (t) => { memToken = t; },
  } = opts;

  const accessTokenUri = `${host}/oauth/token`;
  const revokeTokenUri = `${host}/oauth/revoke`;
  /*
   * SUBSCRIBE TO TOKEN REFRESH
   * Based on https://gist.github.com/mkjiau/650013a99c341c9f23ca00ccb213db1c
   */
  // Keep track if the OAuth token is being refreshed.
  let isRefreshing = false;

  // Array of callbacks to call once token is refreshed.
  let subscribers = [];

  // Add to array of callbacks.
  function subscribeTokenRefresh(resolve, reject) {
    subscribers.push({ resolve, reject });
  }

  // Call all subscribers.
  function onRefreshed(token) {
    subscribers.forEach(({ resolve }) => { resolve(token); });
  }

  // Make sure promises fulfill with a rejection if the refresh fails.
  function onFailedRefresh(error) {
    subscribers.forEach(({ reject }) => { reject(error); });
  }

  // Helper function to parse tokens from server.
  function parseToken(token) {
    // Calculate new expiration time.
    const newToken = !token.expires
      ? { ...token, expires: (Date.now() + token.expires_in * 1000) }
      : token;

    // Update the token state.
    setToken(newToken);

    return newToken;
  }

  // Helper function to refresh OAuth2 token.
  function refreshToken(token) {
    isRefreshing = true;
    const refreshOpts = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'json',
      },
      data: {
        grant_type: 'refresh_token',
        client_id: clientId,
        refresh_token: token,
      },
    };
    return axios(accessTokenUri, refreshOpts)
      .then((res) => {
        const newToken = parseToken(res.data);
        isRefreshing = false;
        onRefreshed(newToken.access_token);
        subscribers = [];
        return newToken;
      })
      .catch((error) => {
        onFailedRefresh(error);
        subscribers = [];
        isRefreshing = false;
        throw error;
      });
  }

  // Helper function to revoke OAuth2 token.
  function revokeToken(tokenType, token) {
    const revokeOpts = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'json',
      },
      data: {
        token_type_hint: tokenType,
        token,
      },
    };
    return axios(revokeTokenUri, revokeOpts)
      .catch((error) => { throw error; });
  }

  // Helper function to get an OAuth access token.
  // This will attempt to refresh the token if needed.
  // Returns a Promise that resvoles as the access token.
  function getAccessToken(token) {
    // Wait for new access token if currently refreshing.
    if (isRefreshing) {
      return new Promise(subscribeTokenRefresh);
    }

    // Refresh if token expired.
    // - 1000 ms to factor for tokens that might expire while in flight.
    if (!isRefreshing && token.expires - 1000 < Date.now()) {
      return new Promise((resolve, reject) => {
        refreshToken(token.refresh_token)
          .then(t => resolve(t.access_token))
          .catch(reject);
      });
    }

    // Else return the current access token.
    return Promise.resolve(token.access_token);
  }

  // Add axios request interceptor to the client.
  // This adds the Authorization Bearer token header.
  client.interceptors.request.use(
    config => getAccessToken(getToken() || {})
      .then(accessToken => ({
        ...config,
        headers: {
          ...config.headers,
          // Only add access token to header.
          Authorization: `Bearer ${accessToken}`,
        },
      }))
      .catch((error) => { throw error; }),
    Promise.reject,
  );

  // Add axios response interceptor to the client.
  // This tries to resolve 403 errors due to expired tokens.
  client.interceptors.response.use(undefined, (err) => {
    const { config } = err;
    const originalRequest = config;

    if (err.response && err.response.status === 403) {
      // Refresh the token and retry.
      if (!isRefreshing) {
        isRefreshing = true;
        const token = getToken();
        return refreshToken(token ? token.refresh_token : {}).then((t) => {
          originalRequest.headers.Authorization = `Bearer ${t.access_token}`;
          return axios(originalRequest);
        }).catch((error) => { throw error; });
      }
      // Else subscribe for new access token after refresh.
      const requestSubscribers = new Promise((resolve, reject) => {
        subscribeTokenRefresh(
          (token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(axios(originalRequest));
          },
          reject,
        );
      });
      return requestSubscribers;
    }
    throw err;
  });
  return {
    authorize: (user, password) => axios(accessTokenUri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'json',
      },
      data: `grant_type=password&username=${user}&password=${password}&client_id=${clientId}`,
    }).then(res => parseToken(res.data))
      .catch((error) => { throw error; }),
    getToken,
    revokeTokens() {
      const token = getToken() || {};
      const revokeAccessToken = revokeToken('access_token', token.access_token);
      const revokeRefreshToken = revokeToken('refresh_token', token.refresh_token);
      return Promise.all([revokeAccessToken, revokeRefreshToken])
        .then(() => true)
        .catch(() => false)
        .finally(() => {
          setToken(null);
        });
    },
  };
};
