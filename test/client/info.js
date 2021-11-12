import chai from 'chai';
import { reportError } from '../report.js';
import { farm, session } from './client.js';

const { expect } = chai;

describe('info', () => {
  it('has farm name in meta field.', () => session()
    .then(() => farm.info())
    .then((response) => {
      expect(response).to.have.nested.property('data.meta.farm.name');
    }).catch(reportError));
});
