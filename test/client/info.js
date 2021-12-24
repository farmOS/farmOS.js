const chai = require('chai');
const { reportError } = require('../report');
const { farm, session } = require('./client');

const { expect } = chai;

describe('info', () => {
  it('has farm name in meta field.', () => session()
    .then(() => farm.info())
    .then((response) => {
      expect(response).to.have.nested.property('data.meta.farm.name');
    }).catch(reportError));
});
