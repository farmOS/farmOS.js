const chai = require('chai');
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
  it('sends a request with multiple subrequests', () => farm.remote.authorize(username, password)
    .then(() => farm.schema.fetch())
    .then(farm.schema.set)
    .then(() => {
      const subrequests = useSubrequests(farm);
      return subrequests.send(sub1);
    })
    .then(({ data: subresponses }) => {
      const quantitySubresponse = subresponses['quantity-create'];
      expect(quantitySubresponse).to.have.a.nested.property('headers.status.0', 201);
      expect(quantitySubresponse).to.be.an('object').that.has.a.property('body');
      const quantityJson = JSON.parse(quantitySubresponse.body);
      expect(quantityJson).to.have.a.nested.property('data.attributes.label', 'hhh');

      const logSubresponse = subresponses['log-create'];
      expect(logSubresponse).to.have.a.nested.property('headers.status.0', 201);
      expect(logSubresponse).to.be.an('object').that.has.a.property('body');
      const logJson = JSON.parse(logSubresponse.body);
      expect(logJson).to.have.a.nested.property(
        'data.attributes.name',
        'application: hhh 20 US_gal_acre',
      );
    })
    .catch(reportError));
});
