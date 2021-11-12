import chai from 'chai';
import client from '../../src/client/index.js';
import localServerConfig from '../../local-server-config.js';
import { reportError } from '../report.js';

const { expect } = chai;

const {
  host, clientId, username, password,
} = localServerConfig;

let token;
const getToken = () => token;
const setToken = (t) => { token = t; };

const farm = client(host, {
  clientId,
  getToken,
  setToken,
});

describe('setHost', () => {
  it('returns a token when a valid user is authorized.', () =>
    farm.authorize(username, password).then((t) => {
      expect(t).to.have.property('token_type', 'Bearer');
      expect(t).to.have.property('access_token').that.is.a('string');
      expect(t).to.have.property('refresh_token').that.is.a('string');
      expect(t).to.have.property('expires').that.is.a('number');
    }).catch(reportError));
  it('resets the host and reauthorizes.', () => {
    const newHost = 'http://127.0.0.1';
    farm.setHost(newHost);
    return farm.authorize(username, password)
      .then((t) => {
        expect(t).to.have.property('token_type', 'Bearer');
        expect(t).to.have.property('access_token').that.is.a('string');
        expect(t).to.have.property('refresh_token').that.is.a('string');
        expect(t).to.have.property('expires').that.is.a('number');
      })
      .catch(reportError);
  });
});
