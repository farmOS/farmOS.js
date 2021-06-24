const { expect } = require('chai');
const farmOS = require('../src');

const host = 'http://localhost';
const clientId = 'farm_client';
const username = 'admin';
const password = 'admin';
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
    const serialized = farm.log.serialize(activity);
    return farm.log.send(serialized)
      .then(() => farm.log.fetch({ filter: { type: 'activity', id } }))
      .then(([remoteActivity]) => {
        activity.name = 'did some more stuff';
        farm.log.merge(activity, remoteActivity);
        const meta = farm.meta.get(activity);
        const {
          fields: {
            name: { changed: nameChanged },
            status: { changed: statusChanged },
          },
        } = meta;
        const nameChangedAfterStatus = new Date(nameChanged) > new Date(statusChanged);
        expect(nameChangedAfterStatus).to.be.true;
        return farm.log.delete({ type: 'activity', id });
      })
      .then(() => farm.log.fetch({ filter: { type: 'activity', id } }))
      .then((responses) => {
        const results = responses.flatMap(r => r.data);
        expect(results).to.have.lengthOf(0);
      });
  });
});
