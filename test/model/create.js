import chai from 'chai';
import { validate } from 'uuid';
import model from '../../src/model/index.js';
import { loadSchema } from '../test-utils.js';

const { expect } = chai;
const activitySchema = loadSchema('log', 'activity');
const farm = model({ schemata: { log: { activity: activitySchema } } });

// Temporary fix until schema tranformations are updated in adapter.js
const drupalMetaFields = {
  attributes: [
    'created',
    'changed',
    'drupal_internal__id',
    'drupal_internal__revision_id',
    'langcode',
    'revision_created',
    'revision_log_message',
    'default_langcode',
    'revision_translation_affected',
    'revision_default',
  ],
  relationships: ['revision_user'],
};
const keys = {
  attributes: [
    ...drupalMetaFields.attributes,
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
    ...drupalMetaFields.relationships,
    'asset',
    'category',
    'equipment',
    'file',
    'image',
    'location',
    'log_type',
    'owner',
    'quantity',
    'uid',
  ],
};

describe('log', () => {
  describe('#create', () => {
    it('creates a valid activity log', () => {
      const activity = farm.log.create({ type: 'activity', name: 'my first log' });
      expect(validate(activity.id)).to.be.true;
      expect(activity.type).to.equal('activity');
      expect(activity.attributes).to.have.all.keys(keys.attributes);
      expect(activity.relationships).to.have.all.keys(keys.relationships);
      expect(Date.parse(activity.attributes.timestamp)).to.not.be.NaN;
    });
    it('throws if no valid type is provided', () => {
      expect(() => farm.log.create({ name: 'bad log' })).to.throw('log type: undefined');
      expect(() => farm.log.create({ type: 'foo', name: 'bad log' })).to.throw('log type: foo');
    });
  });
});
