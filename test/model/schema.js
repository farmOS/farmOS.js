const chai = require('chai');
const model = require('../../dist/cjs/model').default;
const { readSchema } = require('../../core_schemata/fs-utils');

const { expect } = chai;
const activitySchema = readSchema('log', 'activity');
const farm = model({ schemata: { log: { activity: activitySchema } } });

describe('schema', () => {
  describe('#get', () => {
    it('returns the available schemata', () => {
      const logTypes = Object.keys(farm.schema.get('log'));
      expect(logTypes).to.be.an('array').that.includes(
        'activity',
        'observation',
        'input',
        'harvest',
        'lab_test',
        'maintenance',
        'medical',
        'purchase',
        'sale',
        'seeding',
        'transplanting',
      );
    });
  });
  describe('#set', () => {
    it('adds another schema to logs', () => {
      const fooSchema = {
        type: 'object',
        properties: {
          attributes: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
          },
        },
      };
      farm.schema.set('log', 'foo', fooSchema);
      const logTypes = Object.keys(farm.schema.get('log'));
      expect(logTypes).to.be.an('array').that.includes(
        'activity',
        'observation',
        'input',
        'harvest',
        'lab_test',
        'maintenance',
        'medical',
        'purchase',
        'sale',
        'seeding',
        'transplanting',
        'foo',
      );
      const foo = farm.log.create({ type: 'log--foo', name: 'my foo log' });
      expect(foo.attributes.name).to.equal('my foo log');
      expect(foo.type).to.equal('log--foo');
    });
  });
});
