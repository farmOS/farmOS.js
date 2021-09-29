import chai from 'chai'; const { expect } = chai;
import { v4 as uuidv4 } from 'uuid';
import { farm, session } from './client.js';

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
        return farm.term.send('material', term);
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
        return farm.term.send('material', term);
      })
      .then(() => {
        const filter = { name: 'Node Test Revised' };
        return farm.term.fetch('material', { filter });
      })
      .then((response) => {
        const term = response.data.data.find(l => l.id === id);
        expect(term).to.have.nested.property('attributes.name', 'Node Test Revised');
        return farm.term.delete('material', id);
      })
      .then(() => farm.term.fetch('material', { filter: { id } }))
      .then((response) => {
        expect(response.data.data).to.have.lengthOf(0);
      });
  });
});
