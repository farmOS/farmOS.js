const chai = require('chai');
const localServerConfig = require('../../local-server-config');
const { reportError } = require('../report');
const { farm, session } = require('./client');

const { expect } = chai;
const { username } = localServerConfig;

describe('user', function () {
  this.timeout(10000);
  it('can look up all users by uuid.', () => session()
    .then(() => farm.user.fetch('user', { filter: {} }))
    .then((response) => {
      expect(response.data.data).to.be.an.instanceof(Array);
      const user = response.data.data.find(u => u.attributes.name === username);
      expect(user).to.have.property('id');
      return farm.user.fetch('user', { filter: { id: user.id } });
    })
    .then((response) => {
      expect(response.data.data[0]).to.have.nested.property('attributes.name', username);
    })
    .catch(reportError));
});
