const { replace } = require('ramda');
const baseFieldDefaults = require('./baseFieldDefaults');

const typeToBundle = (entity, type) => replace(`${entity}--`, '', type);

const getPropertiesStub = entName => (_, fieldType) =>
  Object.keys(baseFieldDefaults[entName][fieldType]);

const getDefaultStub = entName => (_, fieldType, field) =>
  baseFieldDefaults[entName][fieldType][field];

module.exports = {
  typeToBundle,
  getPropertiesStub,
  getDefaultStub,
};
