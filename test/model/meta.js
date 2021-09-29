import chai from 'chai'; const { expect } = chai;
import model from '../../src/model/index.js';
import schemata from '../../src/model/schemata/stub.js';

const farm = model({ schemata });

describe('meta', () => {
  describe('#resolve', () => {
    const setup = () => {
      const props = { type: 'activity', name: 'local log' };
      const local = farm.log.create(props);
      const remote = farm.log.serialize(local);
      remote.attributes.name = 'remote log';
      remote.attributes.changed = new Date().toISOString();
      delete remote.meta;
      farm.log.merge(local, remote);
      return local;
    };
    it('resolves a conflict, choosing the remote', () => {
      const local = setup();
      expect(local.name).to.equal('local log');
      const { conflicts: cons1 } = farm.meta.get(local).fields.name;
      expect(cons1.length).to.equal(1);
      farm.meta.resolve(local, 'name', () => 0);
      expect(local.name).to.equal('remote log');
      const { conflicts: cons3 } = farm.meta.get(local).fields.name;
      expect(cons3.length).to.equal(0);
    });
    it('resolves a conflict, choosing the local', () => {
      const local = setup();
      expect(local.name).to.equal('local log');
      const { conflicts: cons1 } = farm.meta.get(local).fields.name;
      expect(cons1.length).to.equal(1);
      farm.meta.resolve(local, 'name', () => -1);
      expect(local.name).to.equal('local log');
      const { conflicts: cons3 } = farm.meta.get(local).fields.name;
      expect(cons3.length).to.equal(0);
    });
  });
});
