const chai = require('chai');
const { v4: uuidv4 } = require('uuid');
const { reportError } = require('../report');
const { farm, session } = require('./client');

const { expect } = chai;

describe('log', function () {
  this.timeout(10000);
  it('creates an asset and a log with a relationship to that asset, then fetches the log with its asset included.', () => {
    const logId = uuidv4();
    const assetId = uuidv4();
    return session()
      .then(() => {
        const asset = {
          id: assetId,
          type: 'asset--equipment',
          attributes: {
            name: 'Node Test Include Equipment',
          },
        };
        return farm.asset.send('equipment', asset);
      })
      .then((response) => {
        expect(response).to.have.nested.property('data.data.id', assetId);
        const log = {
          id: logId,
          type: 'log--activity',
          attributes: {
            name: 'Node Test Include Activity',
            timestamp: '2021-04-26T09:18:33Z',
          },
          relationships: {
            asset: { data: [{ id: assetId, type: 'asset--equipment' }] },
          },
        };
        return farm.log.send('activity', log);
      })
      .then((response) => {
        expect(response).to.have.nested.property('data.data.id', logId);
        const opts = { filter: { id: logId }, include: 'asset' };
        return farm.log.fetch('activity', opts);
      })
      .then((response) => {
        expect(response).to.have.nested.property('data.data')
          .that.is.an('array').that.has.lengthOf(1);
        const log = response.data.data.find(l => l.id === logId);
        expect(response).to.have.nested.property('data.included')
          .that.is.an('array').that.has.lengthOf(1);
        const asset = response.data.included.find(e => e.id === assetId);
        expect(log).to.have.nested.property('attributes.name', 'Node Test Include Activity');
        expect(asset).to.have.nested.property('attributes.name', 'Node Test Include Equipment');
        return farm.log.delete('activity', logId);
      })
      .then(() => farm.log.fetch('activity', { filter: { id: logId } }))
      .then((response) => {
        expect(response.data.data).to.have.lengthOf(0);
        return farm.asset.delete('equipment', assetId);
      })
      .then(() => farm.asset.fetch('equipment', { filter: { id: assetId } }))
      .then((response) => {
        expect(response.data.data).to.have.lengthOf(0);
      })
      .catch(reportError);
  });
});
