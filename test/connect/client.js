const connect = require('../../src/connect');
const { typeToBundle } = require('../../src/utils');

const host = 'http://localhost';
const username = 'admin';
const password = 'admin';

let token;
const getToken = () => token;
const setToken = (t) => { token = t; };

// Temporary stubs until farmData is ready to use.
const getTypesStub = entity => ({
  log: ['activity', 'observation', 'input', 'harvest'],
  asset: ['animal', 'plant', 'equipment', 'sensor'],
  taxonomy_term: ['log_category', 'material', 'season'],
})[entity];
const validateStub = (entityName, entity) => {
  const errors = [];
  const valid = entity.type
    && getTypesStub(entityName).includes(typeToBundle(entityName, entity.type));
  if (!valid) {
    const message = `Validation error: ${entity.type} is not a valid ${entityName} type.`;
    errors.push({ message });
  }
  return { valid, errors };
};

const farm = connect(host, {
  clientId: 'farm_client',
  getToken,
  setToken,
  getTypes: getTypesStub,
  validate: validateStub,
});

const session = () => farm.authorize(username, password);

module.exports = { farm, session };
