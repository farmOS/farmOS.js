const client = require('../../dist/cjs/client').default;
const localServerConfig = require('../../local-server-config');

const {
  host, clientId, username, password,
} = localServerConfig;

let token;
const getToken = () => token;
const setToken = (t) => { token = t; };

const farm = client(host, {
  clientId,
  getToken,
  setToken,
});

const session = () => farm.authorize(username, password);

module.exports = { farm, session };
