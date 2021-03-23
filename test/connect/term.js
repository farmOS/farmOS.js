const { expect } = require('chai');
const { v4: uuidv4 } = require('uuid');
const { farm, session } = require('./client');

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
        return farm.term.send(term);
      })
      .then((response) => {
        expect(response).to.have.nested.property('data.id', id);
        const term = {
          id,
          type: 'taxonomy_term--material',
          attributes: {
            name: 'Node Test Revised',
          },
        };
        return farm.term.send(term);
      })
      .then(() => {
        const filter = {
          $or: [
            { type: 'material' },
            { type: 'season' },
          ],
        };
        return farm.term.get({ filter });
      })
      .then((responses) => {
        expect(responses).to.have.lengthOf(2);
        const term = responses
          .flatMap(r => r.data)
          .find(l => l.id === id);
        expect(term).to.have.nested.property('attributes.name', 'Node Test Revised');
        return farm.term.delete({ type: 'material', id });
      })
      .then(() => farm.term.get({ filter: { type: 'material', id } }))
      .then((responses) => {
        const results = responses.flatMap(r => r.data);
        expect(results).to.have.lengthOf(0);
      });
  });
});
