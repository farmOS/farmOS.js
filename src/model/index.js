/* eslint-disable no-param-reassign */
const { clone } = require('ramda');
const createEntity = require('./create');
const serializeEntity = require('./serialize');
const deserializeEntity = require('./deserialize');
const mergeEntity = require('./merge');
const { entities, entityMethods, emptySchemata } = require('../entities');

const meta = Symbol('meta');
const entityNames = entities.map(e => e.name);

function model(opts = {}) {
  const schemata = emptySchemata(entities);

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
      isUnsynced(entity) {
        // Works for serialized entities too.
        const { fields, remote } = (entity[meta] || entity.meta);
        return remote.lastSync === null || Object.values(fields)
          .some(({ changed }) => changed > remote.lastSync);
      },
    },
    ...entityMethods(entities, ({ name }) => ({
      create: createEntity(name, meta, schemata),
      serialize: serializeEntity(name, meta),
      deserialize: deserializeEntity(name, meta, schemata),
      merge: mergeEntity(name, meta, schemata),
    })),
  };
}

module.exports = model;
