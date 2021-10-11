import clone from 'ramda/src/clone.js';
import partition from 'ramda/src/partition.js';
import createEntity from './create.js';
import mergeEntity from './merge.js';
import updateEntity from './update.js';
import { entities, entityMethods, emptySchemata } from '../entities.js';

const entityNames = entities.map(e => e.name);

export default function model(opts = {}) {
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
    ...entityMethods(entities, ({ name }) => ({
      create: createEntity(name, schemata),
      merge: mergeEntity(name, schemata),
      update: updateEntity(name, schemata),
    })),
  };
}
