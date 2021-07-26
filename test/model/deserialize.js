const { expect } = require('chai');
const model = require('../../src/model');
const schemata = require('../../src/model/schemata/stub');

const farm = model({ schemata });

describe('log', () => {
  describe('#deserialize', () => {
    it('deserializes a log', (done) => {
      const name = 'hello';
      const original = farm.log.create({ type: 'activity', name });
      // Use a timeout to make sure the metadata is preserved.
      setTimeout(() => {
        const serialized = farm.log.serialize(original);
        const copy = farm.log.deserialize(serialized);
        expect(copy).to.have.property('name', name);
        const originalMetadata = farm.meta.get(original);
        const copyMetadata = farm.meta.get(copy);
        expect(originalMetadata.fields.name.changed)
          .to.equal(copyMetadata.fields.name.changed);
        done();
      }, 10);
    });
  });
});