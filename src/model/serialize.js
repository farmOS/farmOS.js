import clone from 'ramda/src/clone.js';

const serializeEntity = (entName, meta) => (entity) => {
  const { id, type } = entity;
  if (!id || !type || !entity[meta]) {
    throw new Error(`The ${entName} cannot be read for serialization`);
  }
  const { fields, remote } = clone(entity[meta]);
  const serializedEnt = {
    id,
    type,
    meta: { remote, fields: {} },
    attributes: {},
    relationships: {},
  };
  Object.entries(fields).forEach((field) => {
    const [
      fieldName,
      {
        data, changed, conflicts, fieldType,
      },
    ] = field;
    serializedEnt[fieldType][fieldName] = data;
    serializedEnt.meta.fields[fieldName] = { changed, conflicts };
  });
  return serializedEnt;
};

export default serializeEntity;
