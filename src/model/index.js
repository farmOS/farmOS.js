const { v4: uuidv4 } = require('uuid');
const { clone } = require('ramda');
const { getPropertiesStub, getDefaultStub } = require('../utils');

const meta = Symbol('meta');
const entityNames = [
  'log',
  'asset',
  'term',
  'user',
  'plan',
  'quantity',
];

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
  const schemata = entityNames.reduce((obj, entName) => ({
    ...obj,
    [entName]: {},
  }), {});

  function getSchemata(entName, type) {
    if (!entName) {
      return clone(schemata);
    }
    if (!type) {
      return clone(schemata[entName]);
    }
    return clone(schemata[entName][type]);
  }

  function setSchemata(...args) {
    if (args.length === 1) {
      entityNames.forEach((entName) => {
        if (args[0][entName]) {
          setSchemata(entName, args[0][entName]);
        }
      });
    }
    if (args.length === 2) {
      const [entName, newSchemata] = args;
      if (entityNames.includes(entName)) {
        Object.entries(newSchemata).forEach(([type, schema]) => {
          setSchemata(entName, type, schema);
        });
      }
    }
    if (args.length > 2) {
      const [entName, type, schema] = args;
      schemata[entName][type] = clone(schema);
    }
  }

  setSchemata(opts.schemata);

  const createEntity = entName => (props, metadata = {}) => {
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

  const serializeEntity = entName => (entity) => {
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

  const deserializeEntity = entName => (serializedEnt) => {
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
    return createEntity(entName)(props, metadata);
  };

  return {
    schema: {
      get: getSchemata,
      set: setSchemata,
    },
    meta: {
      get(ent) {
        return clone(ent[meta]);
      },
    },
    ...entityNames.reduce((obj, entName) => ({
      ...obj,
      [entName]: {
        create: createEntity(entName),
        serialize: serializeEntity(entName),
        deserialize: deserializeEntity(entName),
      },
    }), {}),
  };
};
