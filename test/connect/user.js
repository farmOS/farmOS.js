const { expect } = require('chai');
const { session, farm } = require('./client');

describe('user', () => {
  it('can look up all users and admin by uuid.', () => session()
    .then(() => farm.user.fetch({ filter: { type: 'user' } }))
    .then((response) => {
      expect(response[0].data).to.be.an.instanceof(Array);
      const admin = response[0].data.find(u => u.attributes.name === 'admin');
      expect(admin).to.have.property('id');
      return farm.user.fetch({ filter: { type: 'user', id: admin.id } });
    })
    .then((response) => {
      expect(response[0].data[0]).to.have.nested.property('attributes.name', 'admin');
    }));
});
