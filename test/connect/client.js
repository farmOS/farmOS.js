const connect = require('../../src/connect');

const host = 'http://localhost';
const username = 'admin';
const password = 'admin';

let token;
const getToken = () => token;
const setToken = (t) => { token = t; };

const getTypesStub = entity => ({
  log: ['activity', 'observation', 'input', 'harvest'],
  asset: ['animal', 'plant', 'equipment', 'sensor'],
  taxonomy_term: ['log_category', 'material', 'season'],
  quantity: ['standard'],
  user: ['user'],
})[entity];

const farm = connect(host, {
  clientId: 'farm_client',
  getToken,
  setToken,
  getTypes: getTypesStub,
});

const session = () => farm.authorize(username, password);

module.exports = { farm, session };
