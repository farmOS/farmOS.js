const { expect } = require('chai');
const { v4: uuidv4 } = require('uuid');
const { farm, session } = require('./client');

// eslint-disable-next-line func-names
describe('asset', function () {
  this.timeout(10000);
  it('creates an asset with client-generated id, revises, fetches and deletes it.', () => {
    const id = uuidv4();
    return session()
      .then(() => {
        const asset = {
          id,
          type: 'asset--animal',
          attributes: {
            name: 'Node Test Animal',
          },
        };
        return farm.asset.send(asset);
      })
      .then((response) => {
        expect(response).to.have.nested.property('data.id', id);
        const asset = {
          id,
          type: 'asset--animal',
          attributes: {
            name: 'Node Test Animal Revised',
            status: 'archived',
          },
        };
        return farm.asset.send(asset);
      })
      .then(() => {
        const filter = {
          $or: [
            { type: 'animal', status: 'archived' },
            { type: 'plant', status: 'active' },
          ],
        };
        return farm.asset.get({ filter });
      })
      .then((responses) => {
        expect(responses).to.have.lengthOf(2);
        const asset = responses
          .flatMap(r => r.data)
          .find(l => l.id === id);
        expect(asset).to.have.nested.property('attributes.name', 'Node Test Animal Revised');
        return farm.asset.delete({ type: 'animal', id });
      })
      .then(() => farm.asset.get({ filter: { type: 'animal', id } }))
      .then((responses) => {
        const results = responses.flatMap(r => r.data);
        expect(results).to.have.lengthOf(0);
      });
  });
});
