import chai from 'chai';
import model from '../../src/model/index.js';
import { readSchema } from '../../core_schemata/fs-utils.js';

const { expect } = chai;
const activitySchema = readSchema('log', 'activity');
const farm = model({ schemata: { log: { activity: activitySchema } } });

describe('resolve', () => {
  const localUpdate = { name: 'updated locally' };
  const remoteUpdate = { name: 'updated remotely' };
  const setup = () => new Promise((resolve) => {
    // Start with a log created by a remote system.
    const remote = farm.log.create({ type: 'activity', name: 'some log' });
    setTimeout(() => {
      // Simulate fetching the log from the remote.
      const local = farm.log.merge(undefined, remote);
      const updatedLocal = farm.log.update(local, localUpdate);
      setTimeout(() => {
        // An update occurs on the remote just before syncing again.
        const updatedRemote = farm.log.update(remote, remoteUpdate);
        // Simulate fetching it again, after changes have occurred on both systems.
        const mergedLog = farm.log.merge(updatedLocal, updatedRemote);
        resolve(mergedLog);
      }, 10);
    }, 10);
  });
  it('resolves a conflict, choosing the remote', () => setup().then((log) => {
    expect(log.attributes.name).to.equal(localUpdate.name);
    const { meta: { conflicts } } = log;
    expect(conflicts.length, '1 initial conflict').to.equal(1);
    const resolved = farm.meta.resolve(log, 'name', () => 0);
    expect(resolved.attributes.name, 'the remote name to be chosen').to.equal(remoteUpdate.name);
    const { meta: { conflicts: resolvedConflicts } } = resolved;
    expect(resolvedConflicts.length, '0 conflicts after resolution').to.equal(0);
  }));
  it('resolves a conflict, choosing the local', () => setup().then((log) => {
    expect(log.attributes.name).to.equal(localUpdate.name);
    const { meta: { conflicts } } = log;
    expect(conflicts.length).to.equal(1);
    const resolved = farm.meta.resolve(log, 'name', () => -1);
    expect(resolved.attributes.name).to.equal(localUpdate.name);
    const { meta: { conflicts: resolvedConflicts } } = resolved;
    expect(resolvedConflicts.length).to.equal(0);
  }));
});
