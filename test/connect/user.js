import chai from 'chai';
import { farm, session } from './client.js';
import localServerConfig from '../../local-server-config.js';

const { expect } = chai;
const { username } = localServerConfig;

describe('user', () => {
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
    }));
});
