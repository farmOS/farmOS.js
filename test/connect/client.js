import connect from '../../src/connect/index.js';

const host = 'http://localhost';
const username = 'admin';
const password = 'admin';

let token;
const getToken = () => token;
const setToken = (t) => { token = t; };

export const farm = connect(host, {
  clientId: 'farm_client',
  getToken,
  setToken,
});

export const session = () => farm.authorize(username, password);
