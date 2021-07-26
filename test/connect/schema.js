const { expect } = require('chai');
const { session, farm } = require('./client');

describe('schema', () => {
  it('gets a schema for a specified bundle of a specified entity.', () => session()
    .then(() => farm.schema.fetch('log', 'activity'))
    .then((res) => {
      expect(res).to.have.nested.property('definitions.type.const', 'log--activity');
    }));
  it('gets schemata for all bundles of a specified entity.', () => session()
    .then(() => farm.schema.fetch('log'))
    .then((res) => {
      expect(res).to.have.nested.property('activity.definitions.type.const', 'log--activity');
    }));
});