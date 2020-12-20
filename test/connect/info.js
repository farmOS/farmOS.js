const { expect } = require('chai');
const { session, farm } = require('./client');

describe('info', () => {
  it('has farm name in meta field.', () => session()
    .then(() => farm.info())
    .then((response) => {
      expect(response).to.have.nested.property('meta.farm.name');
    }));
});
