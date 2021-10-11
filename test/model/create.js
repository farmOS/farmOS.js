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
      const attributeKeys = Object.keys(baseFieldDefaults.log.attributes);
      const relationshipKeys = Object.keys(baseFieldDefaults.log.relationships);
      expect(activity.attributes).to.have.all.keys(attributeKeys);
      expect(activity.relationships).to.have.all.keys(relationshipKeys);
      expect(Date.parse(activity.attributes.timestamp)).to.not.be.NaN;
    });
    it('throws if no valid type is provided', () => {
      expect(() => farm.log.create({ name: 'bad log' })).to.throw('log type: undefined');
      expect(() => farm.log.create({ type: 'foo', name: 'bad log' })).to.throw('log type: foo');
    });
    it('tracks when a field changes', function (done) {
      this.timeout(3000);
      const delay = 2000;
      const tolerance = 100;
      const activity = farm.log.create({ type: 'activity', name: 'a log' });
      setTimeout(() => {
        const updatedActivity = farm.log.update(activity, { name: 'an updated log' });
        expect(updatedActivity.attributes.name).to.be.equal('an updated log');
        const initTime = new Date(activity.meta.fieldChanges.name);
        const changeTime = new Date(updatedActivity.meta.fieldChanges.name);
        const difference = changeTime - initTime;
        expect(difference).to.be.within(delay - tolerance, delay + tolerance);
        done();
      }, delay);
    });
  });
});
