import clone from 'ramda/src/clone.js';
import map from 'ramda/src/map.js';
import createEntity from './create.js';
import mergeEntity from './merge.js';
import updateEntity from './update.js';
import entities, { entityMethods } from '../entities.js';
import { dereference } from '../json-schema/reference.js';
import { createObserver } from '../utils.js';

/**
 * @typedef {import('../json-schema/reference').JsonSchema} JsonSchema
 * @typedef {import('../json-schema/reference').JsonSchemaDereferenced} JsonSchemaDereferenced
 * An object containing the schemata for the bundles of a farmOS entity, with
 * the bundle name as key and its corresponding schema as its value.
 * @typedef {Object.<string, JsonSchema>} BundleSchemata
 * An object containing the schemata for the bundles of a farmOS entity, with
 * the bundle name as key and its corresponding schema as its value.
 * @typedef {Object.<string, BundleSchemata>} EntitySchemata
 */

/**
 * @typedef {Object} ModelEntityMethods
 * @property {import('./create.js').CreateEntityMethod} create
 * @property {import('./update.js').UpdateEntityMethod} update
 * @property {import('./merge.js').MergeEntityMethod} merge
 */
/**
 * @typedef {Object} FarmModel
 * @property {Object} schema
 * @property {Function} schema.get
 * @property {Function} schema.set
 * @property {Function} schema.on
 * @property {Object} meta
 * @property {Function} meta.isUnsynced
 * @property {ModelEntityMethods} asset
 * @property {ModelEntityMethods} log
 * @property {ModelEntityMethods} plan
 * @property {ModelEntityMethods} quantity
 * @property {ModelEntityMethods} term
 * @property {ModelEntityMethods} user
 */

const entityNames = Object.keys(entities);

/**
 * Create a farm model for generating and manipulating farmOS data structures.
 * @param {Object} options
 * @property {EntitySchemata} [options.schemata]
 * @returns {FarmModel}
 */
export default function model(options = {}) {
  const schemata = map(() => ({}), entities);

  const observers = {
    schema: {
      set: createObserver(),
    },
  };

  /**
   * Retrieve all schemata that have been previously set, or the schemata of a
   * particular entity, or one bundle's schema, if specified.
   * @param {String} [entity] The name of a farmOS entity (eg, 'asset', 'log', etc).
   * @param {String} [type] The entity's type (aka, bundle).
   * @returns {EntitySchemata|BundleSchemata|JsonSchemaDereferenced}
   */
  function getSchemata(entity, type) {
    if (!entity) {
      return clone(schemata);
    }
    if (!type) {
      return clone(schemata[entity]);
    }
    return clone(schemata[entity][type]);
  }

  /**
   * Load all schemata, the schemata of a particular entity, or one bundle's
   * schema, if spcified.
   * @param {...String|EntitySchemata|BundleSchemata|JsonSchema} args
   * @void
   */
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

  setSchemata(options.schemata);

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
