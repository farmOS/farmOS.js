import chai from 'chai';
import { v4 as uuidv4 } from 'uuid';
import { reportError } from '../report.js';
import { farm, session } from './client.js';

const { expect } = chai;

describe('term', function () {
  this.timeout(10000);
  it('creates a term with client-generated id, revises, fetches and deletes it.', () => {
    const id = uuidv4();
    return session()
      .then(() => {
        const term = {
          id,
          type: 'taxonomy_term--material',
          attributes: {
            name: 'Node Test',
          },
        };
        return farm.term.send('material_type', term);
      })
      .then((response) => {
        expect(response).to.have.nested.property('data.data.id', id);
        const term = {
          id,
          type: 'taxonomy_term--material',
          attributes: {
            name: 'Node Test Revised',
          },
        };
        return farm.term.send('material_type', term);
      })
      .then(() => {
        const filter = { name: 'Node Test Revised' };
        return farm.term.fetch('material_type', { filter });
      })
      .then((response) => {
        const term = response.data.data.find(l => l.id === id);
        expect(term).to.have.nested.property('attributes.name', 'Node Test Revised');
        return farm.term.delete('material_type', id);
      })
      .then(() => farm.term.fetch('material_type', { filter: { id } }))
      .then((response) => {
        expect(response.data.data).to.have.lengthOf(0);
      })
      .catch(reportError);
  });
});
