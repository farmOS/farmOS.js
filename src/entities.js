import { reduceObjIndexed } from './utils.js';

const byType = {
  string: () => '',
  boolean: () => false,
  object: () => null,
  array: () => [],
};
const byFormat = {
  'date-time': () => new Date().toISOString(),
};
export const defaultOptions = { byType, byFormat };

/**
 * @typedef {Object} EntityReference
 * @property {String} id A v4 UUID as specified by RFC 4122.
 * @property {String} type Corresponding to the entity bundle (eg, 'activity').
 */

/**
 * @typedef {Object} Entity
 * @property {String} id A v4 UUID as specified by RFC 4122.
 * @property {String} type The combined form of entity & bundle (eg, 'log--activity').
 * @property {Object} attributes Values directly attributable to this entity.
 * @property {Object.<String, EntityReference|Array.<EntityReference>>} relationships
 * References to other entities that define a one-to-one or one-to-many relationship.
 * @property {Object} meta Non-domain information associated with the creation,
 * modification, storage and transmission of the entity.
 * @property {String} meta.created An ISO 8601 date-time string indicating when
 * the entity was first created, either locally or remotely.
 * @property {String} meta.changed An ISO 8601 date-time string indicating when
 * the entity was last changed, either locally or remotely.
 * @property {Object} meta.remote
 * @property {Object} meta.fieldChanges
 * @property {Array} meta.conflicts
 */

// Configuration objects for the entities supported by this library.

/**
 * @typedef {Object} EntityConfig
 * @property {Object} nomenclature
 * @property {Object} nomenclature.name
 * @property {Object} nomenclature.shortName
 * @property {Object} nomenclature.plural
 * @property {Object} nomenclature.shortPlural
 * @property {Object} nomenclature.display
 * @property {Object} nomenclature.displayPlural
 * @property {Object} defaultOptions
 * @property {Object} defaultOptions.byType
 * @property {Object} defaultOptions.byFormat
 */

/** @type {Object.<String, EntityConfig>} */
/**
 * @typedef {Object.<String, EntityConfig>} DefaultEntities
 * @property {EntityConfig} asset
 * @property {EntityConfig} log
 * @property {EntityConfig} plan
 * @property {EntityConfig} quantity
 * @property {EntityConfig} taxonomy_term
 * @property {EntityConfig} user
 */
export default {
  asset: {
    nomenclature: {
      name: 'asset',
      shortName: 'asset',
      plural: 'assets',
      shortPlural: 'assets',
      display: 'Asset',
      displayPlural: 'Assets',
    },
    defaultOptions,
  },
  file: {
    nomenclature: {
      name: 'file',
      shortName: 'file',
      plural: 'files',
      shortPlural: 'files',
      display: 'File',
      displayPlural: 'Files',
    },
    defaultOptions,
  },
  log: {
    nomenclature: {
      name: 'log',
      shortName: 'log',
      plural: 'logs',
      shortPlural: 'logs',
      display: 'Log',
      displayPlural: 'Logs',
    },
    defaultOptions,
  },
  plan: {
    nomenclature: {
      name: 'plan',
      shortName: 'plan',
      plural: 'plans',
      shortPlural: 'plans',
      display: 'Plan',
      displayPlural: 'Plans',
    },
    defaultOptions,
  },
  quantity: {
    nomenclature: {
      name: 'quantity',
      shortName: 'quantity',
      plural: 'quantities',
      shortPlural: 'quantities',
      display: 'Quantity',
      displayPlural: 'Quantities',
    },
    defaultOptions,
  },
  taxonomy_term: {
    nomenclature: {
      name: 'taxonomy_term',
      shortName: 'term',
      plural: 'taxonomy_terms',
      shortPlural: 'terms',
      display: 'Taxonomy Term',
      displayPlural: 'Taxonomy Terms',
    },
    defaultOptions,
  },
  user: {
    nomenclature: {
      name: 'user',
      shortName: 'user',
      plural: 'users',
      shortPlural: 'users',
      display: 'User',
      displayPlural: 'Users',
    },
    defaultOptions,
  },
};

export const entityMethods = (fn, allConfigs) =>
  reduceObjIndexed((methods, config) => ({
    ...methods,
    [config.nomenclature.shortName]: {
      ...fn(config),
    },
  }), {}, allConfigs);
