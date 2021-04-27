const { reduce } = require('ramda');

// Configuration objects for the entities supported by this library.
const entities = [
  {
    name: 'asset',
    shortName: 'asset',
  },
  {
    name: 'log',
    shortName: 'log',
  },
  {
    name: 'plan',
    shortName: 'plan',
  },
  {
    name: 'quantity',
    shortName: 'quantity',
  },
  {
    name: 'taxonomy_term',
    shortName: 'term',
  },
  {
    name: 'user',
    shortName: 'user',
  },
];

// Takes a list of entity configs and returns an empty schemata object.
const emptySchemata = reduce((s, { name }) => ({ ...s, [name]: {} }), {});

// Factory function that creates entity methods that can be spread into
// the return object.
const entityMethods = (configs, fn) =>
  configs.reduce((methods, config) => ({
    ...methods,
    [config.shortName]: {
      ...fn(config),
    },
  }), {});

module.exports = { entities, emptySchemata, entityMethods };
