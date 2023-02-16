const chai = require('chai');
const farmOS = require('../dist/cjs/farmOS').default;
const localServerConfig = require('./local-server-config');
const { reportError } = require('./report');

const { expect } = chai;
const {
  host, clientId, username, password,
} = localServerConfig;
const remote = { host, clientId };

describe('subrequest', function () {
  this.timeout(10000);
  const farm = farmOS({ remote });
  const session = farm.remote.authorize(username, password)
    .then(() => farm.schema.fetch().then(farm.schema.set));

  const fetchAll = () => Promise.all([
    farm.log.fetch({
      filter: { type: 'log--input', name: 'application in west field' },
    }),
    farm.quantity.fetch({
      filter: { type: 'quantity--standard', label: ['fff', 'ggg', 'hhh'] },
    }),
    farm.asset.fetch({
      filter: { type: 'asset--land', name: 'west field bed 12' },
    }),
    farm.term.fetch({
      filter: { type: 'taxonomy_term--log_category', name: 'pest_disease_control' },
    }),
    farm.term.fetch({
      filter: { type: 'taxonomy_term--unit', name: ['US_gal', 'US_gal_acre'] },
    }),
  ]);

  const cleanup = (shortName, bundle, response) =>
    response.data.map(d => farm[shortName].delete(bundle, d.id));
  const cleanupAll = ([logs, quantities, locations, categories, units]) => Promise.all([
    cleanup('log', 'input', logs),
    cleanup('quantity', 'standard', quantities),
    cleanup('asset', 'land', locations),
  ].flat()).then(() => Promise.all([
    // These terms can only be deleted AFTER the entities referencing them have been.
    cleanup('term', 'log_category', categories),
    cleanup('term', 'unit', units),
  ].flat()));

  this.beforeAll(() => session
    .then(() => farm.schema.fetch()).then(farm.schema.set)
    .then(() => fetchAll().then(cleanupAll))
    .catch(reportError));

  it('Send both a quantity and a log with subrequests', () => session.then(() => {
    const quantF = farm.quantity.create({
      type: 'quantity--standard',
      label: 'fff',
      measure: 'weight',
      inventory_asset: null,
    });
    const quantG = farm.quantity.create({
      type: 'quantity--standard',
      label: 'ggg',
      measure: 'weight',
      inventory_asset: null,
    });
    const quantH = farm.quantity.create({
      type: 'quantity--standard',
      label: 'hhh',
      measure: 'volume',
      inventory_asset: null,
    });
    const quantities = [quantF, quantG, quantH];

    const quantOptions = {
      subrequest(quant) {
        const { attributes: { measure } } = quant;
        const unitName = measure === 'volume' ? 'US_gal' : 'US_gal_acre';
        return {
          units: {
            $find: {
              type: 'taxonomy_term--unit',
              name: unitName,
            },
            $sort: {
              weight: 'DESC',
            },
            $limit: 1,
            $createIfNotFound: true,
          },
        };
      },
    };

    return farm.quantity.send(quantities, quantOptions);
  }).then((responses) => {
    expect(responses).to.have.a.lengthOf(3);
    const sorted = responses.sort((a, b) =>
      a.attributes.label.localeCompare(b.attributes.label));
    const [quantF, quantG, quantH] = sorted;
    expect(quantF).to.have.nested.property('attributes.measure', 'weight');
    expect(quantG).to.have.nested.property('attributes.measure', 'weight');
    expect(quantH).to.have.nested.property('attributes.measure', 'volume');
    const { relationships: { units: { id: unitF } } } = quantF;
    const { relationships: { units: { id: unitG } } } = quantG;
    const { relationships: { units: { id: unitH } } } = quantH;
    expect(unitF).to.equal(unitG);
    expect(unitG).not.to.equal(unitH);

    const quantity = responses.map(({ id, type }) => ({ id, type }));
    const log = farm.log.create({
      type: 'log--input', name: 'application in west field', quantity,
    });
    const logOptions = {
      subrequest: {
        location: {
          $find: {
            type: 'asset--land',
            status: 'active',
            land_type: 'bed',
            name: 'west field bed 12',
            is_location: true,
          },
          $limit: 1,
          $createIfNotFound: true,
        },
        category: {
          $find: {
            type: 'taxonomy_term--log_category',
            name: 'pest_disease_control',
          },
          $limit: 1,
          $createIfNotFound: true,
        },
      },
    };

    return farm.log.send(log, logOptions);
  }).then((responses) => {
    expect(responses).to.have.a.lengthOf(1);
    const [log] = responses;
    expect(log).to.have.nested.property('relationships.quantity')
      .that.has.a.lengthOf(3);
    return session;
  }).catch(reportError));

  this.afterAll(() => fetchAll().then(cleanupAll).catch(reportError));
});
