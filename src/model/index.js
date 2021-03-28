/* eslint-disable no-param-reassign */
const { v4: uuidv4 } = require('uuid');
const {
  clone, compose, cond, eqBy, equals, has, identity, isNil, map, prop,
} = require('ramda');
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

  // Helpers for determining if a set of fields are equivalent. Attributes are
  // fairly straightforward, but relationships need to be compared strictly by
  // their id(s), b/c JSON:API gives a lot of leeway for how these references
  // can be structured.
  const setOfIds = compose(
    array => new Set(array),
    map(prop('id')),
  );
  const relsTransform = cond([
    [isNil, identity],
    [Array.isArray, setOfIds],
    [has('id'), prop('id')],
  ]);
  const eqFields = fieldType =>
    (fieldType === 'relationships' ? eqBy(relsTransform) : equals);

  const mergeEntity = entName => (local, remote) => {
    if (local.id !== remote.id) {
      throw new Error(`Cannot merge remote ${entName} (UUID: ${remote.id}) `
        + `with local ${entName} (UUID: ${local.id}).`);
    }
    if (local.type !== remote.type) {
      throw new Error(`Cannot merge remote ${remote.type} ${entName} `
        + `with local ${local.type} ${entName}.`);
    }
    if (!local[meta]) {
      throw new Error(`Cannot merge ${entName} because local metadata is unreadable.`);
    }
    const { lastSync } = local[meta].remote;
    // This loop comprises the main algorithm for merging concurrent copies of
    // the entity on separate systems. It depends on the local metadata stored
    // for each field, remote metadata sent with the entity, and the timestamp
    // (lastSync) that local data for this entity was last sent to the remote
    // system. Unfortunately, b/c not all remotes store metadata with the same
    // level of granularity, we can only depend on the `created` field they
    // send, so not all conflicts can be resolved without manual intervention.
    Object.entries(local[meta].fields).forEach(([fieldName, field]) => {
      const { fieldType } = field;
      const fieldsAreEqual = eqFields(fieldType);
      const remoteMetadata = (remote.meta && remote.meta.fields
        && remote.meta.fields[fieldName]) || {};
      const lChange = new Date(field.changed);
      const rChange = new Date(remoteMetadata.changed || remote.attributes.changed || Date.now());
      const lChangeHasBeenSynced = lastSync !== null && new Date(lastSync) > lChange;
      // If the remote entity changed more recently than the local entity, and
      // the local entity was synced more recently than it changed,
      // use the remote entity's value.
      if (rChange > lChange && lChangeHasBeenSynced) {
        field.changed = rChange.toISOString();
        field.data = remote[fieldType][fieldName];
        return;
      }
      // If the local entity changed more recently than the remote entity, or
      // the local entity was synced more recently than the remote entity changed,
      // keep the local entity's value (ie, do nothing).
      if (rChange < lChange || lChangeHasBeenSynced) {
        return;
      }
      // If the remote entity changed since the last sync, while the local entity
      // still has outstanding changes, we have a conflict, so long as the
      // values are not equivalent.
      if (!fieldsAreEqual(remote[fieldType][fieldName], field.data)) {
        field.conflicts.push({
          changed: rChange.toISOString(),
          data: remote[fieldType][fieldName],
        });
      }
      // Otherwise, they are equivalent, so do nothing.
    });
    local[meta].remote.url = remote.links && remote.links.self && remote.links.self.href;
  };

  return {
    schema: {
      get: getSchemata,
      set: setSchemata,
    },
    meta: {
      get(entity) {
        return clone(entity[meta]);
      },
      setLastSync(entity, time = new Date()) {
        // The call to toISOString will (purposely) throw if a valid time
        // parameter is not provided.
        const date = 'toISOString' in time ? time : new Date(time);
        const iso = date.toISOString();
        entity[meta].remote.lastSync = iso;
      },
      resolve(entity, field, cb) {
        const { conflicts } = entity[meta].fields[field];
        const index = cb(clone(conflicts));
        const winner = conflicts[index];
        if (typeof index === 'number') {
          if (winner !== undefined) {
            entity[meta].fields[field].data = winner.data;
            entity[meta].fields[field].changed = winner.changed;
          }
          if (index <= conflicts.length - 1) {
            entity[meta].fields[field].conflicts = [];
          }
        }
      },
    },
    ...entityNames.reduce((obj, entName) => ({
      ...obj,
      [entName]: {
        create: createEntity(entName),
        serialize: serializeEntity(entName),
        deserialize: deserializeEntity(entName),
        merge: mergeEntity(entName),
      },
    }), {}),
  };
};
