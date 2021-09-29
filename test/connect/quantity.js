import chai from 'chai'; const { expect } = chai;
import { v4 as uuidv4 } from 'uuid';
import { farm, session } from './client.js';

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
        return farm.quantity.send('standard', quantity);
      })
      .then((response) => {
        expect(response).to.have.nested.property('data.data.id', id);
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
        return farm.quantity.send('standard', quantity);
      })
      .then(() => {
        const filter = { label: 'artichokes' };
        return farm.quantity.fetch('standard', { filter });
      })
      .then((response) => {
        const quantity = response.data.data.find(l => l.id === id);
        expect(quantity).to.have.nested.property('attributes.value.numerator', 36);
        return farm.quantity.delete('standard', id);
      })
      .then(() => farm.quantity.fetch('standard', { filter: { id } }))
      .then((response) => {
        expect(response.data.data).to.have.lengthOf(0);
      });
  });
});
