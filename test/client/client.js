import client from '../../src/client/index.js';
import localServerConfig from '../../local-server-config.js';

const {
  host, clientId, username, password,
} = localServerConfig;

let token;
const getToken = () => token;
const setToken = (t) => { token = t; };

export const farm = client(host, {
  clientId,
  getToken,
  setToken,
});

export const session = () => farm.authorize(username, password);
