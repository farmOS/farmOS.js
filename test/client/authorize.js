import chai from 'chai';
import { session } from './client.js';

const { expect } = chai;

describe('authorize', () => {
  it('returns a token when a valid user is authorized.', () => session()
    .then((token) => {
      expect(token).to.have.property('token_type', 'Bearer');
      expect(token).to.have.property('access_token').that.is.a('string');
      expect(token).to.have.property('refresh_token').that.is.a('string');
      expect(token).to.have.property('expires').that.is.a('number');
    }));
});
