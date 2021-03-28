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
  describe('#merge', () => {
    it('merges a remote log with no conflicts', (done) => {
      const props = { type: 'activity', name: 'local log' };
      const local = farm.log.create(props);
      setTimeout(() => {
        farm.meta.setLastSync(local);
        const remote = farm.log.serialize(local);
        remote.attributes.name = 'remote log';
        remote.attributes.changed = new Date().toISOString();
        delete remote.meta;
        setTimeout(() => {
          farm.log.merge(local, remote);
          expect(local.name).to.equal('remote log');
          const { conflicts } = farm.meta.get(local).fields.name;
          expect(conflicts.length).to.equal(0);
          done();
        }, 10);
      }, 10);
    });
    it('merges a remote, non-Drupal log with no conflicts', (done) => {
      const props = { type: 'activity', name: 'local log' };
      const local = farm.log.create(props);
      setTimeout(() => {
        farm.meta.setLastSync(local);
        const remote = farm.log.serialize(local);
        remote.attributes.name = 'remote log';
        remote.meta.fields.name.changed = new Date().toISOString();
        setTimeout(() => {
          farm.log.merge(local, remote);
          expect(local.name).to.equal('remote log');
          const { conflicts } = farm.meta.get(local).fields.name;
          expect(conflicts.length).to.equal(0);
          done();
        }, 10);
      }, 10);
    });
  });
});
