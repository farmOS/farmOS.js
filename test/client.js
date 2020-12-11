const farmOS = require('../src/index');

const host = 'http://localhost';
const username = 'admin';
const password = 'admin';

let token;
const getToken = () => token;
const setToken = (t) => { token = t; };

const farm = farmOS(host, {
  clientId: 'farm_client',
  getToken,
  setToken,
});

const session = () => farm.authorize(username, password);

module.exports = { farm, session };
