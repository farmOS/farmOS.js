import chai from 'chai'; const { expect } = chai;
import { farm, session } from './client.js';

describe('user', () => {
  it('can look up all users and admin by uuid.', () => session()
    .then(() => farm.user.fetch('user', { filter: {} }))
    .then((response) => {
      expect(response.data.data).to.be.an.instanceof(Array);
      const admin = response.data.data.find(u => u.attributes.name === 'admin');
      expect(admin).to.have.property('id');
      return farm.user.fetch('user', { filter: { id: admin.id } });
    })
    .then((response) => {
      expect(response.data.data[0]).to.have.nested.property('attributes.name', 'admin');
    }));
});
