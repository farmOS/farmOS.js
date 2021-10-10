import chai from 'chai';
import { validate } from 'uuid';
import model from '../../src/model/index.js';
import schemata from '../../src/model/schemata/stub.js';
import baseFieldDefaults from '../../src/model/schemata/baseFieldDefaults.js';

const { expect } = chai;

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
    it('tracks when a field changes', function (done) {
      this.timeout(3000);
      const activity = farm.log.create({ type: 'activity', name: 'a log' });
      const initTime = new Date(farm.meta.get(activity).fields.name.changed);
      const delay = 2000;
      const tolerance = 100;
      setTimeout(() => {
        activity.name = 'an updated log';
        expect(activity.name).to.be.equal('an updated log');
        const changeTime = new Date(farm.meta.get(activity).fields.name.changed);
        const difference = changeTime - initTime;
        expect(difference).to.be.within(delay - tolerance, delay + tolerance);
        done();
      }, delay);
    });
  });
});
