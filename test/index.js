const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const farmOS = require('../dist/cjs/farmOS').default;
const localServerConfig = require('../local-server-config');
const { reportError } = require('./report');

chai.use(chaiAsPromised);
const { expect } = chai;

const {
  host, clientId, username, password,
} = localServerConfig;
const remote = { host, clientId };

describe('farmOS', function () {
  this.timeout(10000);
  const farm = farmOS({ remote });
  const session = farm.remote.authorize(username, password);
  it('can authenticate with the server', () => session
    .then((token) => { expect(token).to.have.property('access_token'); }));
  it('fetches remote schemata and sets them locally', () => session
    .then(() => farm.schema.fetch())
    .then((res) => {
      farm.schema.set(res);
      const season = farm.schema.get('taxonomy_term', 'season');
      expect(season).to.have.nested.property('properties.type.const', 'season');
    })
    .catch(reportError));
  it('create an activity log, send it to the server and delete it', () => {
    const activity = farm.log.create({ type: 'activity', name: 'did some stuff' });
    const { id } = activity;
    return farm.log.send(activity)
      .then(() => farm.log.fetch({ filter: { type: 'activity', id } }))
      .then(({ data: [remoteActivity] }) => {
        const updatedActivity = farm.log.update(activity, { name: 'did some more stuff' });
        const mergedActivity = farm.log.merge(updatedActivity, remoteActivity);
        const {
          meta: { fieldChanges: { name: nameChanged, status: statusChanged } },
        } = mergedActivity;
        const nameChangedAfterStatus = new Date(nameChanged) > new Date(statusChanged);
        expect(nameChangedAfterStatus).to.be.true;
        return farm.log.delete('activity', id);
      })
      .then(() => farm.log.fetch({ filter: { type: 'activity', id } }))
      .then((results) => {
        expect(results.data).to.have.lengthOf(0);
      })
      .catch(reportError);
  });
  it('resets the host using remote.add, then authorizes again.', () => {
    const newHost = 'http://127.0.0.1';
    farm.remote.add({ host: newHost, clientId });
    return farm.remote.authorize(username, password)
      .then((t) => {
        expect(t).to.have.property('token_type', 'Bearer');
        expect(t).to.have.property('access_token').that.is.a('string');
        expect(t).to.have.property('refresh_token').that.is.a('string');
        expect(t).to.have.property('expires').that.is.a('number');
        return farm.remote.request('/api');
      })
      .then(({ data: { meta } }) => {
        expect(meta).to.have.nested.property('farm.url', newHost);
      })
      .catch(reportError);
  });
  it('fails to authorize when given an invalid host', () => {
    const invalidHost = 'http://localhost:123SesameStreet';
    farm.remote.add({ host: invalidHost, clientId });
    const invalidAuthRequest = farm.remote.authorize(username, password);
    return expect(invalidAuthRequest).to.be.rejected;
  });
});
