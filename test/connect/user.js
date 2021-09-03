const { expect } = require('chai');
const { session, farm } = require('./client');

describe('user', () => {
  it('can look up all users and admin by uuid.', () => session()
    .then(() => farm.user.fetch('user', { filter: {} }))
    .then((response) => {
      expect(response.data).to.be.an.instanceof(Array);
      const admin = response.data.find(u => u.attributes.name === 'admin');
      expect(admin).to.have.property('id');
      return farm.user.fetch('user', { filter: { id: admin.id } });
    })
    .then((response) => {
      expect(response.data[0]).to.have.nested.property('attributes.name', 'admin');
    }));
});
