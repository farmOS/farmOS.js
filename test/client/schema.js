const chai = require('chai');
const { reportError } = require('../report');
const { farm, session } = require('./client');

const { expect } = chai;

describe('schema', function () {
  this.timeout(10000);
  it('gets the schema for a specified entity (\'log\') and bundle (\'activity\').', () => session()
    .then(() => farm.schema.fetch('log', 'activity'))
    .then((res) => {
      expect(res).to.have.nested.property('definitions.type.const', 'log--activity');
    }).catch(reportError));
  it('gets the schema for a specified entity (\'log\') and type (\'log--activity\').', () => session()
    .then(() => farm.schema.fetch('log', 'log--activity'))
    .then((res) => {
      expect(res).to.have.nested.property('definitions.type.const', 'log--activity');
    }).catch(reportError));
  it('gets the schema for a specified type (\'log--activity\').', () => session()
    .then(() => farm.schema.fetch('log--activity'))
    .then((res) => {
      expect(res).to.have.nested.property('definitions.type.const', 'log--activity');
    }).catch(reportError));
  it('gets schemata for all bundles of a specified entity.', () => session()
    .then(() => farm.schema.fetch('log'))
    .then((res) => {
      expect(res).to.have.nested.property('activity.definitions.type.const', 'log--activity');
    }).catch(reportError));
  it('gets all schemata.', () => session()
    .then(() => farm.schema.fetch())
    .then((res) => {
      expect(res).to.have.nested.property('log.activity.definitions.type.const', 'log--activity');
    }).catch(reportError));
});
