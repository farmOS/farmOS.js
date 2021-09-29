import chai from 'chai'; const { expect } = chai;
import connect from '../../src/connect/index.js';

const host = 'http://localhost';
const username = 'admin';
const password = 'admin';

let token;
const getToken = () => token;
const setToken = (t) => { token = t; };

const farm = connect(host, {
  clientId: 'farm_client',
  getToken,
  setToken,
});

describe('setHost', () => {
  it('returns a token when a valid user is authorized.', () =>
    farm.authorize(username, password).then((t) => {
      expect(t).to.have.property('token_type', 'Bearer');
      expect(t).to.have.property('expires_in', 3600);
      expect(t).to.have.property('access_token').that.is.a('string');
      expect(t).to.have.property('refresh_token').that.is.a('string');
      expect(t).to.have.property('expires').that.is.a('number');
    }));
  it('resets the host and reauthorizes.', () => {
    const newHost = 'http://127.0.0.1';
    farm.setHost(newHost);
    return farm.authorize(username, password)
      .then((t) => {
        expect(t).to.have.property('token_type', 'Bearer');
        expect(t).to.have.property('expires_in', 3600);
        expect(t).to.have.property('access_token').that.is.a('string');
        expect(t).to.have.property('refresh_token').that.is.a('string');
        expect(t).to.have.property('expires').that.is.a('number');
      });
  });
});
