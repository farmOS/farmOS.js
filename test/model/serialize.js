import chai from 'chai';
import model from '../../src/model/index.js';
import schemata from '../../src/model/schemata/stub.js';

const { expect } = chai;

const farm = model({ schemata });

describe('log', () => {
  describe('#serialize', () => {
    it('serializes a log', () => {
      const name = 'hello';
      const activity = farm.log.create({ type: 'activity', name });
      const serializedActivity = farm.log.serialize(activity);
      expect(serializedActivity).to.have.property('id');
      expect(serializedActivity).to.have.property('type');
      expect(serializedActivity).to.have.property('meta');
      expect(serializedActivity).to.have.property('attributes');
      expect(serializedActivity).to.have.property('relationships');
      expect(serializedActivity.attributes).to.have.property('name', name);
    });
  });
});
