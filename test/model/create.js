const chai = require('chai');
const { validate } = require('uuid');
const model = require('../../dist/cjs/model').default;
const { readSchema } = require('../../core_schemata/fs-utils');

const { expect } = chai;
const activitySchema = readSchema('log', 'activity');
const farm = model({ schemata: { log: { activity: activitySchema } } });

const keys = {
  attributes: [
    'name',
    'timestamp',
    'status',
    'flag',
    'geometry',
    'notes',
    'data',
    'is_movement',
  ],
  relationships: [
    'asset',
    'category',
    'equipment',
    'file',
    'image',
    'location',
    'owner',
    'quantity',
  ],
};

describe('log', () => {
  describe('#create', () => {
    it('creates a valid activity log', () => {
      const activity = farm.log.create({ type: 'log--activity', name: 'my first log' });
      expect(validate(activity.id)).to.be.true;
      expect(activity.type).to.equal('log--activity');
      expect(activity.attributes).to.have.all.keys(keys.attributes);
      expect(activity.relationships).to.have.all.keys(keys.relationships);
      expect(Date.parse(activity.attributes.timestamp)).to.not.be.NaN;
    });
    it('throws if no valid type is provided', () => {
      expect(() => farm.log.create({ name: 'bad log' })).to.throw();
      expect(() => farm.log.create({ type: 'foo', name: 'bad log' })).to.throw();
    });
  });
});
