import clone from 'ramda/src/clone.js';
import map from 'ramda/src/map.js';
import partition from 'ramda/src/partition.js';
import createEntity from './create.js';
import mergeEntity from './merge.js';
import updateEntity from './update.js';
import entities, { entityMethods } from '../entities.js';
import { dereference } from '../json-schema/reference.js';
import { createObserver } from '../utils.js';

const entityNames = Object.keys(entities);

export default function model(opts = {}) {
  const schemata = map(() => ({}), entities);

  const observers = {
    schema: {
      set: createObserver(),
    },
  };

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
        if (entName in args[0]) {
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
      schemata[entName][type] = dereference(schema);
      observers.schema.set.next(getSchemata());
    }
  }

  setSchemata(opts.schemata);

  const addListeners = namespace => (name, callback) => {
    if (name in observers[namespace]) {
      return observers[namespace][name].subscribe(callback);
    }
    throw new Error(`Invalid method name for ${namespace} listener: ${name}`);
  };

  return {
    schema: {
      get: getSchemata,
      set: setSchemata,
      on: addListeners('schema'),
    },
    meta: {
      resolve(entity, field, cb) {
        const copy = clone(entity);
        const byField = c => c.field === field;
        const [conflicts, others] = partition(byField, copy.meta.conflicts);
        const index = cb(conflicts);
        if (typeof index !== 'number') return copy;
        if (index > -1 && index < conflicts.length) {
          const { changed, data, fieldType } = conflicts[index];
          copy[fieldType][field] = data;
          copy.meta.fieldChanges[field] = changed;
          copy.meta.conflicts = others;
          if (changed > copy.meta.changed) copy.meta.changed = changed;
        }
        if (index === -1) {
          copy.meta.conflicts = others;
        }
        return copy;
      },
      isUnsynced(entity) {
        const { changed, remote: { lastSync } } = entity.meta;
        return lastSync === null || changed > lastSync;
      },
    },
    ...entityMethods(({ nomenclature: { name } }) => ({
      create: createEntity(name, schemata),
      merge: mergeEntity(name, schemata),
      update: updateEntity(name, schemata),
    }), entities),
  };
}
