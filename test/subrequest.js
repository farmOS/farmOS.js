const chai = require('chai');
const { mergeRight } = require('ramda');
const farmOS = require('../dist/cjs/farmOS').default;
const { useSubrequests } = require('../dist/cjs/farmOS');
const localServerConfig = require('./local-server-config');
const { reportError } = require('./report');

const { expect } = chai;
const {
  host, clientId, username, password,
} = localServerConfig;
const remote = { host, clientId };

const sub1 = {
  $create: {
    type: 'log--input',
    name: 'west field bed 12',
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
    owner: {
      $find: {
        type: 'user--user',
        mail: 'admin@our-sci.net',
      },
      $limit: 1,
      $createIfNotFound: true,
    },
    quantity: {
      $create: {
        type: 'quantity--standard',
        label: 'hhh',
        measure: 'weight',
        units: {
          $find: {
            type: 'taxonomy_term--unit',
            name: 'US_gal_acre',
          },
          $sort: {
            weight: 'DESC',
          },
          $limit: 1,
          $createIfNotFound: true,
        },
      },
    },
  },
};

/**
 * These tests currently fail b/c the server's relationship endpoint behaves unexpectedly.
 * {@see https://github.com/farmOS/farmOS.js/blob/d1d4ee3913ba9017ec125ab3d2aa2f0a9bf88631/src/client/subrequest.js#L184-L202}
 * {@see https://jsonapi.org/format/#crud-updating-to-many-relationships}
 */
describe('subrequest', function () {
  this.timeout(10000);
  const farm = farmOS({ remote });
  const session = farm.remote.authorize(username, password);
  const subrequests = useSubrequests(farm);

  const fetchAll = () => Promise.all([
    farm.log.fetch({ filter: { type: 'log--input', name: 'west field bed 12' } }),
    farm.quantity.fetch({ filter: { type: 'quantity--standard', label: 'hhh' } }),
    farm.asset.fetch({ filter: { type: 'asset--land', name: 'west field bed 12' } }),
    farm.term.fetch({ filter: { type: 'taxonomy_term--log_category', name: 'pest_disease_control' } }),
    farm.term.fetch({ filter: { type: 'taxonomy_term--unit', name: 'US_gal_acre' } }),
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

  this.beforeAll(() => session.then(() => farm.schema.fetch()).then(farm.schema.set));

  it('parses a subrequest', () => {
    const parsed = subrequests.parse(sub1);
    const requestIds = [
      '$ROOT::$create:log--input.location::$find:asset--land',
      '$ROOT::$create:log--input.location::$createIfNotFound:asset--land',
      '$ROOT::$create:log--input.category::$find:taxonomy_term--log_category',
      '$ROOT::$create:log--input.category::$createIfNotFound:taxonomy_term--log_category',
      '$ROOT::$create:log--input.owner::$find:user--user',
      '$ROOT::$create:log--input.owner::$createIfNotFound:user--user',
      '$ROOT::$create:log--input.quantity::$create:quantity--standard.units::'
        + '$find:taxonomy_term--unit',
      '$ROOT::$create:log--input.quantity::$create:quantity--standard.units::'
        + '$createIfNotFound:taxonomy_term--unit',
      '$ROOT::$create:log--input.quantity::$create:quantity--standard',
      '$ROOT::$create:log--input',
    ];
    expect(parsed, 'Response ID\'s').to.have.all.keys(requestIds);
  });
  it('sends a request with multiple subrequests', () => subrequests.send(sub1)
    .then((responses) => {
      const contentIds = [
        // First batch of requests.
        '$ROOT::$create:log--input.location::$find:asset--land',
        '$ROOT::$create:log--input.category::$find:taxonomy_term--log_category',
        '$ROOT::$create:log--input.owner::$find:user--user',
        '$ROOT::$create:log--input.quantity::$create:quantity--standard.units'
          + '::$find:taxonomy_term--unit',
        // Second batch of requests.
        '$ROOT::$create:log--input.owner::$createIfNotFound:user--user',
        '$ROOT::$create:log--input.quantity::$create:quantity--standard',
        '$ROOT::$create:log--input',
        '$ROOT::$create:log--input.quantity#uri{0}#body{0}',
        '$ROOT::$create:log--input.quantity#uri{1}#body{0}',
      ];

      const subresponses = responses.map(sub => sub.data).reduce(mergeRight, {});
      expect(subresponses, 'Content ID\'s').to.have.all.keys(contentIds);
    })
    .then(fetchAll)
    .then(([logs, quantities, locations, categories, units]) => {
      expect(logs, 'logs').to.have.property('data').that.has.a.lengthOf(1);
      expect(quantities, 'quantities').to.have.property('data').that.has.a.lengthOf(1);
      expect(locations, 'locations').to.have.property('data').that.has.a.lengthOf(1);
      expect(categories, 'categories').to.have.property('data').that.has.a.lengthOf(1);
      expect(units, 'units').to.have.property('data').that.has.a.lengthOf(1);

      const { data: [log] } = logs;
      const { data: [quantity] } = quantities;
      expect(log, 'location id')
        .to.have.nested.property('relationships.location[0].id', locations.data[0].id);
      expect(log, 'category id')
        .to.have.nested.property('relationships.category[0].id', categories.data[0].id);
      expect(log, 'quantity id')
        .to.have.nested.property('relationships.quantity[0].id', quantities.data[0].id);
      expect(quantity, 'units id')
        .to.have.nested.property('relationships.units.id', units.data[0].id);
    })
    .catch(reportError));
  this.afterAll(() => fetchAll().then(cleanupAll));
});
