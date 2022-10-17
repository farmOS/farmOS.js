const chai = require('chai');
const model = require('../../dist/cjs/model').default;
const { readSchema } = require('../../core_schemata/fs-utils');

const { expect } = chai;
const activitySchema = readSchema('log', 'activity');
const farm = model({ schemata: { log: { activity: activitySchema } } });

describe('log', () => {
  describe('#update', () => {
    it('tracks when a field updates', function (done) {
      this.timeout(1500);
      const delay = 1000;
      const tolerance = 100;
      const activity = farm.log.create({ type: 'log--activity', name: 'a log' });
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
