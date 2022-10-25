import clone from 'ramda/src/clone.js';
import dropLast from 'ramda/src/dropLast.js';
import map from 'ramda/src/map.js';
import createEntity from './create.js';
import mergeEntity from './merge.js';
import updateEntity from './update.js';
import defaultEntities, { entityMethods } from '../entities.js';
import { dereference } from '../json-schema/reference.js';
import { parseEntityType } from '../types.js';
import { createObserver, isObject } from '../utils.js';

/**
 * JSON Schema for defining the entities supported by a farmOS instance.
 * @see {@link https://json-schema.org/understanding-json-schema/index.html}
 * @typedef {import('../json-schema/reference').JsonSchema} JsonSchema
 */
/**
 * JSON Schema Dereferenced: A JSON Schema, but w/o any $ref keywords. As such,
 * it may contain circular references that cannot be serialized.
 * @typedef {import('../json-schema/reference').JsonSchemaDereferenced} JsonSchemaDereferenced
 */
/**
 * An object containing the schemata for the bundles of a farmOS entity, with
 * the bundle name as key and its corresponding schema as its value.
 * @typedef {Object.<string, JsonSchema>} BundleSchemata
 */
/**
 * An object containing the schemata for the bundles of a farmOS entity, with
 * the bundle name as key and its corresponding schema as its value.
 * @typedef {Object.<string, BundleSchemata>} EntitySchemata
 */

/** The methods for writing to local copies of farmOS data structures, such as
 * assets, logs, etc.
 * @typedef {Object} ModelEntityMethods
 * @property {import('./create.js').createEntity} create
 * @property {import('./update.js').updateEntity} update
 * @property {import('./merge.js').mergeEntity} merge
 */
/** A collection of functions for working with farmOS data structures, their
 * associated metadata and schemata.
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

/**
 * @typedef {import('../entities.js').EntityConfig} EntityConfig
 */
/**
 * Create a farm model for generating and manipulating farmOS data structures.
 * @typedef {Function} model
 * @param {Object} options
 * @property {EntitySchemata} [options.schemata]
 * @property {Object<String, EntityConfig>} [options.entities=defaultEntities]
 * @returns {FarmModel}
 */
export default function model(options = {}) {
  const { entities = defaultEntities } = options;
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
   * @param {String} [bundle] The entity's bundle (eg, 'activity' for type 'log--activity').
   * @returns {EntitySchemata|BundleSchemata|JsonSchemaDereferenced}
   */
  function getSchemata(entity, bundle) {
    if (schemata[entity] && schemata[entity][bundle]) {
      return clone(schemata[entity][bundle]);
    }
    if (schemata[entity]) {
      return clone(schemata[entity]);
    }
    return clone(schemata);
  }

  /**
   * Load all schemata, the schemata of a particular entity, or one bundle's
   * schema, if specified.
   * @param {...String|EntitySchemata|BundleSchemata|JsonSchema} args
   * @void
   */
  function setSchemata(...args) {
    if (args.length === 0) {
      throw new Error('At least one valid argument is required for setting '
        + 'farm schemata but none was provided.');
    }
    if (args.length === 1 && isObject(args[0])) {
      const [entitySchemata] = args;
      Object.entries(entitySchemata).forEach(([entity, bundleSchemata]) => {
        if (entity in schemata) {
          setSchemata(entity, bundleSchemata);
        }
      });
      return clone(schemata);
    }
    if (args.length === 2 && isObject(args[1])) {
      const type0 = parseEntityType(args[0]);
      if (type0.entity in schemata && type0.bundle) {
        const { entity, bundle } = type0;
        const [, schema] = args;
        setSchemata(entity, bundle, schema);
        return clone(schemata)[entity][bundle];
      }
      const [entity, bundleSchemata] = args;
      Object.entries(bundleSchemata).forEach(([type1, schema]) => {
        const { bundle = type1 } = parseEntityType(type1);
        setSchemata(entity, bundle, schema);
      });
      return clone(schemata)[entity];
    }
    if (args.length === 3
      && args[0] in schemata
      && typeof args[1] === 'string'
      && isObject(args[2])) {
      const [entity, type, schema] = args;
      const { bundle = type } = parseEntityType(type);
      schemata[entity][bundle] = dereference(schema);
      return clone(schemata)[entity][bundle];
    }
    const description = 'One or more invalid arguments for setting farm schemata';
    throw new Error(`${description}: ${args.join(', ')}.`);
  }

  if (options.schemata) setSchemata(options.schemata);

  const addListeners = namespace => (name, callback) => {
    if (name in observers[namespace]) {
      return observers[namespace][name].subscribe(callback);
    }
    throw new Error(`Invalid method name for ${namespace} listener: ${name}`);
  };

  return {
    schema: {
      get: getSchemata,
      /** @param {...String|EntitySchemata|BundleSchemata|JsonSchema} args */
      set(...args) {
        setSchemata(...args);
        const getterArgs = dropLast(1, args);
        observers.schema.set.next(getSchemata(...getterArgs));
      },
      on: addListeners('schema'),
    },
    meta: {
      isUnsynced(entity) {
        const { changed, remote: { lastSync } } = entity.meta;
        return lastSync === null || changed > lastSync;
      },
    },
    ...entityMethods(({ defaultOptions }) => ({
      create: createEntity(schemata, defaultOptions),
      merge: mergeEntity(schemata),
      update: updateEntity(schemata),
    }), entities),
  };
}
