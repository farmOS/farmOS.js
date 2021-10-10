import chai from 'chai';
import model from '../../src/model/index.js';
import schemata from '../../src/model/schemata/stub.js';

const { expect } = chai;

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
