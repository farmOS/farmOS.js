const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const farmOS = require('../dist/cjs/farmOS').default;
const localServerConfig = require('./local-server-config');
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
  it('fetches all remote schemata and automatically sets them locally', () => session
    .then(() => farm.schema.fetch())
    .then(() => {
      const schemata = farm.schema.get();
      expect(schemata).to.have.all.keys([
        'asset', 'file', 'log', 'plan', 'quantity', 'taxonomy_term', 'user',
      ]);
      const terms = farm.schema.get('taxonomy_term');
      expect(terms).to.have.all.keys([
        'animal_type',
        'crop_family',
        'log_category',
        'material_type',
        'unit',
        'plant_type',
        'season',
      ]);
      const season = farm.schema.get('taxonomy_term', 'season');
      expect(season).to.have.nested.property('properties.type.const', 'taxonomy_term--season');
    })
    .catch(reportError));
  it('fetches the schema for a specified entity (\'log\') and bundle (\'activity\').', () => session
    .then(() => farm.schema.fetch('log', 'activity'))
    .then((res) => {
      expect(res).to.have.nested.property('data.properties.type.const', 'log--activity');
    }).catch(reportError));
  it('fetches the schema for a specified entity (\'log\') and type (\'log--activity\').', () => session
    .then(() => farm.schema.fetch('log', 'log--activity'))
    .then((res) => {
      expect(res).to.have.nested.property('data.properties.type.const', 'log--activity');
    }).catch(reportError));
  it('fetches the schema for a specified type (\'log--activity\').', () => session
    .then(() => farm.schema.fetch('log--activity'))
    .then((res) => {
      expect(res).to.have.nested.property('data.properties.type.const', 'log--activity');
    }).catch(reportError));
  it('fetches schemata for all bundles of a specified entity.', () => session
    .then(() => farm.schema.fetch('log'))
    .then((res) => {
      expect(res).to.have.nested.property('data.activity.properties.type.const', 'log--activity');
    }).catch(reportError));
  it('creates an activity log and equipment asset, sends them to the server, then fetches both using include option', () => {
    const equipment = farm.asset.create({ type: 'asset--equipment', name: 'really good tractor' });
    const { id: equipmentId } = equipment;
    const activity = farm.log.create({
      type: 'log--activity',
      attributes: { name: 'did some stuff' },
      relationships: { equipment: [{ id: equipmentId, type: 'asset--equipment' }] },
    });
    const { id: activityId } = activity;
    const filter = { type: 'log--activity', id: activityId };
    const include = ['equipment'];
    return farm.asset.send(equipment)
      .then(() => farm.log.send(activity))
      .then(() => farm.log.fetch({ filter, include }))
      .then((response) => {
        expect(response).to.have.property('data').that.has.lengthOf(2);
        const { data: [remoteActivity, remoteEquipment] } = response;
        expect(remoteEquipment).to.have.nested.property('attributes.name', 'really good tractor');
        const updatedActivity = farm.log.update(activity, { name: 'did some more stuff' });
        const mergedActivity = farm.log.merge(updatedActivity, remoteActivity);
        const {
          meta: { fieldChanges: { name: nameChanged, status: statusChanged } },
        } = mergedActivity;
        const nameChangedAfterStatus = new Date(nameChanged) > new Date(statusChanged);
        expect(nameChangedAfterStatus).to.be.true;
        return farm.log.delete('activity', activityId);
      })
      .then(() => farm.log.fetch({ filter: { type: 'log--activity', id: activityId } }))
      .then((results) => {
        expect(results.data).to.have.lengthOf(0);
        return farm.asset.delete('equipment', equipmentId);
      })
      .then(() => farm.asset.fetch({ filter: { type: 'asset--equipment', id: equipmentId } }))
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
