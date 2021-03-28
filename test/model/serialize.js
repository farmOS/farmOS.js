const { expect } = require('chai');
const model = require('../../src/model');
const schemata = require('../../src/model/schemata/stub');

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
