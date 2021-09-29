import clone from 'ramda/src/clone.js';
import createEntity from './create.js';

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

export default deserializeEntity;
