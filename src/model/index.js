/* eslint-disable no-param-reassign */
const { clone } = require('ramda');
const createEntity = require('./create');
const serializeEntity = require('./serialize');
const deserializeEntity = require('./deserialize');
const mergeEntity = require('./merge');

const meta = Symbol('meta');
const entityNames = [
  'log',
  'asset',
  'term',
  'user',
  'plan',
  'quantity',
];

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

  // Factory function that creates entity methods that can be spread into
  // the return object.
  function entityMethods(names) {
    return names.reduce((obj, entName) => ({
      ...obj,
      [entName]: {
        create: createEntity(entName, meta, schemata),
        serialize: serializeEntity(entName, meta),
        deserialize: deserializeEntity(entName, meta, schemata),
        merge: mergeEntity(entName, meta, schemata),
      },
    }), {});
  }

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
    ...entityMethods(entityNames),
  };
};
