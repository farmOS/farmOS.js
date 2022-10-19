const chai = require('chai');
const { mergeRight } = require('ramda');
const farmOS = require('../dist/cjs/farmOS').default;
const { useSubrequests } = require('../dist/cjs/farmOS');
const localServerConfig = require('../local-server-config');
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

describe('subrequest', function () {
  this.timeout(10000);
  const farm = farmOS({ remote });
  const session = farm.remote.authorize(username, password);
  const subrequests = useSubrequests(farm);
  before(() => session.then(() => farm.schema.fetch()).then(farm.schema.set));
  it('parses a subrequest', () => {
    const parsed = subrequests.parse(sub1);
    const requestIds = [
      '$ROOT::$create:log--input.location::$find:asset--land',
      '$ROOT::$create:log--input.location::$createIfNotFound:asset--land',
      '$ROOT::$create:log--input.category::$find:taxonomy_term--log_category',
      '$ROOT::$create:log--input.category::$createIfNotFound:taxonomy_term--log_category',
      '$ROOT::$create:log--input.owner::$find:user--user',
      '$ROOT::$create:log--input.owner::$createIfNotFound:user--user',
      '$ROOT::$create:log--input.quantity::$create:quantity--standard.units::$find:taxonomy_term--unit',
      '$ROOT::$create:log--input.quantity::$create:quantity--standard.units::$createIfNotFound:taxonomy_term--unit',
      '$ROOT::$create:log--input.quantity::$create:quantity--standard',
      '$ROOT::$create:log--input',
    ];
    expect(parsed).to.have.all.keys(requestIds);
  });
  it('sends a request with multiple subrequests', () => subrequests.send(sub1)
    .then((responses) => {
      const requestIds = [
        '$ROOT::$create:log--input',
        '$ROOT::$create:log--input.quantity::$create:quantity--standard',
        '$ROOT::$create:log--input.category::$find:taxonomy_term--log_category',
        '$ROOT::$create:log--input.location::$find:asset--land',
        '$ROOT::$create:log--input.owner::$find:user--user',
        '$ROOT::$create:log--input.owner::$createIfNotFound:user--user',
        '$ROOT::$create:log--input.quantity::$create:quantity--standard.units::$find:taxonomy_term--unit',
      ];
      const subresponses = responses.map(sub => sub.data).reduce(mergeRight, {});
      expect(subresponses).to.have.all.keys(requestIds);

      const [
        inputRequestId, quantRequestId,, catRequestId,, landRequestId,,,, unitRequestId,
      ] = requestIds;

      expect(subresponses).to.include.key(inputRequestId);
      const inputSubresponse = subresponses[inputRequestId];
      const { body: { data: input } = {} } = inputSubresponse;
      expect(input).to.have.property('type', 'log--input');
      expect(input).to.have.nested.property('attributes.name', 'west field bed 12');
      expect(input).to.have.nested.property('relationships.category.data')
        .that.has.lengthOf(1);

      expect(subresponses).to.include.key(quantRequestId);
      const quantSubresponse = subresponses[quantRequestId];
      const { body: { data: quantity } = {} } = quantSubresponse;
      expect(quantity).to.have.property('type', 'quantity--standard');
      expect(quantity).to.have.nested.property('attributes.label', 'hhh');

      // The rest of these aren't for testing but for cleanup purposes.
      const catSubresponse = subresponses[catRequestId];
      const { body: { data: category } = {} } = catSubresponse;
      const landSubresponse = subresponses[landRequestId];
      const { body: { data: land } = {} } = landSubresponse;
      const unitSubresponse = subresponses[unitRequestId];
      const { body: { data: unit } = {} } = unitSubresponse;

      const cleanupRound1 = Promise.all([
        farm.log.delete('input', input.id),
        farm.quantity.delete('standard', quantity.id),
        farm.asset.delete('land', land.id),
      ]);
      // These terms can only be deleted AFTER the entities referencing them have been.
      const cleanupRound2 = () => Promise.all([
        farm.term.delete('log_category', category.id),
        farm.term.delete('unit', unit.id),
      ]);
      return cleanupRound1.then(cleanupRound2);
    })
    .catch(reportError));
});
