const { v4: uuidv4 } = require('uuid');
const { clone } = require('ramda');
const { getPropertiesStub, getDefaultStub } = require('../utils');

const meta = Symbol('meta');

function setOnce(obj, key, value) {
  const writable = value === undefined;
  Object.defineProperty(obj, key, {
    value,
    writable,
    configurable: true,
    enumerable: true,
  });
}

module.exports = function model(opts = {}) {
  const { schemata = {} } = opts;
  const _schemata = clone(schemata);

  const createEntity = entName => (props, metadata) => {
    const getProperties = getPropertiesStub(entName); // TODO: Replace stub
    const getDefault = getDefaultStub(entName); // TODO: Replace stub
    const { type } = props;
    const schema = _schemata[entName] && _schemata[entName][type];
    if (!schema) { throw new Error(`Cannot find a schema for the ${entName} type: ${type}.`); }
    const entity = {};
    setOnce(entity, 'id', uuidv4());
    setOnce(entity, 'type', type);
    const now = new Date().toISOString();
    Object.defineProperty(entity, meta, {
      writable: true,
      enumerable: false,
      value: {
        remote: { lastSync: null, url: null },
        fields: {},
      },
    });
    const attributes = getProperties(schema, 'attributes')
      .map(attr => ({ field: attr, fieldType: 'attributes' }));
    const relationships = getProperties(schema, 'relationships')
      .map(rel => ({ field: rel, fieldType: 'relationships' }));
    attributes.concat(relationships).forEach(({ field, fieldType }) => {
      const data = props[field] !== undefined
        ? props[field]
        : getDefault(schema, fieldType, field);
      const {
        changed = now,
        conflicts = [],
      } = (metadata && metadata.fields && metadata.fields[field]) || {};
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

  return {
    log: {
      create: createEntity('log'),
    },
    asset: {
      create: createEntity('asset'),
    },
    term: {
      create: createEntity('term'),
    },
    user: {
      create: createEntity('user'),
    },
    plan: {
      create: createEntity('plan'),
    },
    quantity: {
      create: createEntity('quantity'),
    },
  };
};
