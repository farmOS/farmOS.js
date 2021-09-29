import chai from 'chai'; const { expect } = chai;
import { farm, session } from './client.js';

describe('info', () => {
  it('has farm name in meta field.', () => session()
    .then(() => farm.info())
    .then((response) => {
      expect(response).to.have.nested.property('data.meta.farm.name');
    }));
});
