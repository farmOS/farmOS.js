import chai from 'chai';
import { reportError } from '../report.js';
import { farm, session } from './client.js';

const { expect } = chai;

describe('schema', () => {
  it('gets a schema for a specified bundle of a specified entity.', () => session()
    .then(() => farm.schema.fetch('log', 'activity'))
    .then((res) => {
      expect(res).to.have.nested.property('definitions.type.const', 'log--activity');
    }).catch(reportError));
  it('gets schemata for all bundles of a specified entity.', () => session()
    .then(() => farm.schema.fetch('log'))
    .then((res) => {
      expect(res).to.have.nested.property('activity.definitions.type.const', 'log--activity');
    }).catch(reportError));
});
