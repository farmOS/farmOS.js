import chai from 'chai';
import model from '../../src/model/index.js';
import schemata from '../../src/model/schemata/stub.js';

const { expect } = chai;

const farm = model({ schemata });

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
      farm.schema.set('log', 'foo', {});
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
      const foo = farm.log.create({ type: 'foo', name: 'my foo log' });
      expect(foo.name).to.equal('my foo log');
      expect(foo.type).to.equal('foo');
    });
  });
});
