const connect = require('../src/connect');

const host = 'http://localhost';
const username = 'admin';
const password = 'admin';

let token;
const getToken = () => token;
const setToken = (t) => { token = t; };

const farm = connect(host, {
  clientId: 'farm_client',
  getToken,
  setToken,
});

const session = () => farm.authorize(username, password);

module.exports = { farm, session };
