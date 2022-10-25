const chai = require('chai');
const { reportError } = require('../report');
const { farm, session } = require('./client');

const { expect } = chai;

describe('schema', function () {
  this.timeout(10000);
  it('gets the schema for a specified entity (\'log\') and bundle (\'activity\').', () => session()
    .then(() => farm.schema.fetch('log', 'activity'))
    .then((res) => {
      expect(res).to.have.nested.property('data.definitions.type.const', 'log--activity');
    }).catch(reportError));
});
