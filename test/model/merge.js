const { expect } = require('chai');
const model = require('../../src/model');
const schemata = require('../../src/model/schemata/stub');

const farm = model({ schemata });

describe('log', () => {
  describe('#merge', () => {
    it('merges a remote log with no conflicts', (done) => {
      const props = { type: 'activity', name: 'local log' };
      const local = farm.log.create(props);
      setTimeout(() => {
        farm.meta.setLastSync(local);
        const remote = farm.log.serialize(local);
        remote.attributes.name = 'remote log';
        remote.attributes.changed = new Date().toISOString();
        delete remote.meta;
        setTimeout(() => {
          farm.log.merge(local, remote);
          expect(local.name).to.equal('remote log');
          const { conflicts } = farm.meta.get(local).fields.name;
          expect(conflicts.length).to.equal(0);
          done();
        }, 10);
      }, 10);
    });
    it('merges a remote, non-Drupal log with no conflicts', (done) => {
      const props = { type: 'activity', name: 'local log' };
      const local = farm.log.create(props);
      setTimeout(() => {
        farm.meta.setLastSync(local);
        const remote = farm.log.serialize(local);
        remote.attributes.name = 'remote log';
        remote.meta.fields.name.changed = new Date().toISOString();
        setTimeout(() => {
          farm.log.merge(local, remote);
          expect(local.name).to.equal('remote log');
          const { conflicts } = farm.meta.get(local).fields.name;
          expect(conflicts.length).to.equal(0);
          done();
        }, 10);
      }, 10);
    });
  });
});
