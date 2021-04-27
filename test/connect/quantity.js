const { expect } = require('chai');
const { v4: uuidv4 } = require('uuid');
const { farm, session } = require('./client');

describe('quantity', function () {
  this.timeout(10000);
  it('creates a quantity with client-generated id, revises, fetches and deletes it.', () => {
    const id = uuidv4();
    return session()
      .then(() => {
        const quantity = {
          id,
          type: 'quantity--standard',
          attributes: {
            measure: 'weight',
            value: {
              numerator: 42,
              denominator: 1,
            },
            label: 'artichokes',
          },
          relationships: {
            units: {
              type: 'taxonomy_term--unit',
              id: 'b73f96bf-466d-48a3-b129-da8933c4c905',
            },
          },
        };
        return farm.quantity.send(quantity);
      })
      .then((response) => {
        expect(response).to.have.nested.property('data.id', id);
        const quantity = {
          id,
          type: 'quantity--standard',
          attributes: {
            value: {
              numerator: 36,
              denominator: 1,
            },
          },
        };
        return farm.quantity.send(quantity);
      })
      .then(() => {
        const filter = {
          $or: [
            { type: 'standard' },
          ],
        };
        return farm.quantity.fetch({ filter });
      })
      .then((responses) => {
        expect(responses).to.have.lengthOf(1);
        const quantity = responses
          .flatMap(r => r.data)
          .find(l => l.id === id);
        expect(quantity).to.have.nested.property('attributes.value.numerator', 36);
        return farm.quantity.delete({ type: 'standard', id });
      })
      .then(() => farm.quantity.fetch({ filter: { type: 'standard', id } }))
      .then((responses) => {
        const results = responses.flatMap(r => r.data);
        expect(results).to.have.lengthOf(0);
      });
  });
});
