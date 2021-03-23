const { expect } = require('chai');
const { validate } = require('uuid');
const model = require('../../src/model');
const schemata = require('../../src/model/schemata/stub');
const baseFieldDefaults = require('../../src/utils/baseFieldDefaults');

const farm = model({ schemata });

describe('log', () => {
  describe('#create', () => {
    it('creates a valid activity log', () => {
      const activity = farm.log.create({ type: 'activity', name: 'my first log' });
      expect(validate(activity.id)).to.be.true;
      expect(activity.type).to.equal('activity');
      const keys = Object.keys(baseFieldDefaults.log.attributes)
        .concat(Object.keys(baseFieldDefaults.log.relationships), 'id', 'type');
      expect(activity).to.have.all.keys(keys);
      expect(Date.parse(activity.timestamp)).to.not.be.NaN;
    });
    it('throws if no valid type is provided', () => {
      expect(() => farm.log.create({ name: 'bad log' })).to.throw('log type: undefined');
      expect(() => farm.log.create({ type: 'foo', name: 'bad log' })).to.throw('log type: foo');
    });
    it('throws if you try to change the log type', () => {
      const activity = farm.log.create({
        type: 'activity',
        name: 'I\'ll always be an activity!',
      });
      const changeType = () => {
        'use strict';

        activity.type = 'observation';
      };
      expect(changeType).to.throw();
      expect(activity).to.have.property('type', 'activity');
    });
  });
});
