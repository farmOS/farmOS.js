import chai from 'chai';
import farmOS from '../src/index.js';
import localServerConfig from '../local-server-config.js';

const { expect } = chai;

const {
  host, clientId, username, password,
} = localServerConfig;
const remote = {
  options: { host, clientId },
};

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
    }));
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
      });
  });
});
