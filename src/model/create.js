const { v4: uuidv4 } = require('uuid');
const { getPropertiesStub, getDefaultStub, setOnce } = require('../utils');

const createEntity = (entName, meta, schemata) => (props, metadata = {}) => {
  const getProperties = getPropertiesStub(entName); // TODO: Replace stub
  const getDefault = getDefaultStub(entName); // TODO: Replace stub
  const { id = uuidv4(), type } = props;
  const schema = schemata[entName][type];
  if (!schema) { throw new Error(`Cannot find a schema for the ${entName} type: ${type}.`); }
  const entity = {};
  setOnce(entity, 'id', id);
  setOnce(entity, 'type', type);
  const {
    remote: { lastSync = null, url = null } = {},
    fields: metafields = {},
  } = metadata;
  const now = new Date().toISOString();
  Object.defineProperty(entity, meta, {
    writable: true,
    enumerable: false,
    value: {
      remote: { lastSync, url },
      fields: {},
    },
  });
  const attributes = getProperties(schema, 'attributes')
    .map(attr => ({ field: attr, fieldType: 'attributes' }));
  const relationships = getProperties(schema, 'relationships')
    .map(rel => ({ field: rel, fieldType: 'relationships' }));
  attributes.concat(relationships).forEach(({ field, fieldType }) => {
    let data;
    if (field in props) {
      data = props[field];
    } else if (field in metafields) {
      ({ data } = metafields[field]);
    } else {
      data = getDefault(schema, fieldType, field);
    }
    const {
      changed = now,
      conflicts = [],
    } = metafields[field] || {};
    entity[meta].fields[field] = {
      data, changed, conflicts, fieldType,
    };
    Object.defineProperty(entity, field, {
      enumerable: true,
      configurable: true,
      get: function entityPropGetter() {
        return this[meta].fields[field].data;
      },
      set: function entityPropSetter(val) {
        this[meta].fields[field].changed = new Date().toISOString();
        this[meta].fields[field].data = val;
      },
    });
  });
  Object.preventExtensions(entity);
  return entity;
};

module.exports = createEntity;
