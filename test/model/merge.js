const chai = require('chai');
const model = require('../../dist/cjs/model').default;
const { readSchema } = require('../../core_schemata/fs-utils');

const { expect } = chai;
const activitySchema = readSchema('log', 'activity');
const farm = model({ schemata: { log: { activity: activitySchema } } });

describe('log', () => {
  describe('#merge', () => {
    it('merges a remote log with no conflicts', (done) => {
      // Start with a log created locally.
      const local = farm.log.create({ type: 'log--activity', name: 'local log' });
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
