const { clone } = require('ramda');
const createEntity = require('./create');

const deserializeEntity = (entName, meta, schemata) => (serializedEnt) => {
  const {
    id,
    type,
    meta: metadata,
    attributes = {},
    relationships = {},
  } = clone(serializedEnt);
  const props = {
    id, type, ...attributes, ...relationships,
  };
  return createEntity(entName, meta, schemata)(props, metadata);
};

module.exports = deserializeEntity;
