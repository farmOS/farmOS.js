import chai from 'chai';
import model from '../../src/model/index.js';
import schemata from '../../src/model/schemata/stub.js';

const { expect } = chai;

const farm = model({ schemata });

describe('log', () => {
  describe('#merge', () => {
    it('merges a remote log with no conflicts', (done) => {
      // Start with a log created locally.
      const local = farm.log.create({ type: 'activity', name: 'local log' });
      setTimeout(() => {
        // Simulate syncing it to a remote system, which then updates it.
        const remote = farm.log.merge(undefined, local);
        const syncedLocal = farm.log.merge(local, remote);
        const updatedRemote = farm.log.update(remote, { name: 'remote log' });
        setTimeout(() => {
          // Simulate sending it back to the original system.
          const merged = farm.log.merge(syncedLocal, updatedRemote);
          expect(merged.attributes.name).to.equal('remote log');
          const { meta: { conflicts } } = merged;
          expect(conflicts.length).to.equal(0);
          done();
        }, 10);
      }, 10);
    });
  });
});
