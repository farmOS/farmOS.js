const chai = require('chai');
const farmOS = require('../dist/cjs/farmOS').default;
const parseFilter = require('../dist/cjs/parse-filter').default;
const { generateFieldTransforms, transformLocalEntity } = require('../dist/cjs/farmOS');
const localServerConfig = require('../local-server-config');
const { reportError } = require('./report');

const { expect } = chai;
const {
  host, clientId, username, password,
} = localServerConfig;
const remote = { host, clientId };

describe('subrequest', function () {
  this.timeout(10000);
  const farm = farmOS({ remote });
  it('sends a request with multiple subrequests', () => farm.remote.authorize(username, password)
    .then(() => farm.schema.fetch())
    .then(farm.schema.set)
    .then(() => {
      const headers = { Accept: 'application/vnd.api+json' };
      // Set up subrequests for each of the entity relationships the log will
      // depend on: the category, land and user entities.
      const catSearchParams = parseFilter({ name: 'pest_disease_control' });
      const catUri = `/api/taxonomy_term/log_category?${catSearchParams}`;
      const catSubrequest = {
        requestId: 'cat-view',
        uri: catUri,
        action: 'view',
        headers,
      };
      const landSearchParams = parseFilter({ name: 'west field bed 12' });
      const landUri = `/api/asset/land?${landSearchParams}`;
      const landSubrequest = {
        requestId: 'land-view',
        uri: landUri,
        action: 'view',
        headers,
      };
      const userSearchParams = parseFilter({ name: 'farm' });
      const userUri = `/api/user/user?${userSearchParams}`;
      const userSubrequest = {
        requestId: 'user-view',
        uri: userUri,
        action: 'view',
        headers,
      };
      // The log will not directly depend upon this unit, but it will depend upon
      // the quantity we create later, which will depend on the unit.
      const unitSearchParams = parseFilter({ name: 'US_gal_acre' });
      const unitUri = `/api/taxonomy_term/unit?${unitSearchParams}`;
      const unitSubrequest = {
        requestId: 'unit-view',
        uri: unitUri,
        action: 'view',
        headers,
      };
      // Send the request (note the _format=json query param).
      return farm.remote.request('/subrequests?_format=json', {
        method: 'POST',
        data: [
          catSubrequest,
          landSubrequest,
          userSubrequest,
          unitSubrequest,
        ],
      });
    })
    .then((response) => {
      const { data: subresponses } = response;
      const subrequests = [];
      const headers = {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
      };

      // Transform functions are generated at runtime based on the available
      // schemata; these functions are passed to transformLocalEntity, which
      // transforms entities into the format accepted by the server. This is a
      // bit of ugliness we should hope to avoid by abstracting this process
      // into the .send() method and letting the adapter handle it.
      const transforms = generateFieldTransforms(farm.schema.get());

      // Evaluate the subresponses to determine if a matching entity was found
      // for each subrequest, as indicated by a valid UUID.
      const catMatches = JSON.parse(subresponses['cat-view'].body);
      let catId = catMatches && catMatches.data[0] && catMatches.data[0].id;
      const landMatches = JSON.parse(subresponses['land-view'].body);
      let landId = landMatches && landMatches.data[0] && landMatches.data[0].id;
      const userMatches = JSON.parse(subresponses['user-view'].body);
      let userId = userMatches && userMatches.data[0] && userMatches.data[0].id;
      const unitMatches = JSON.parse(subresponses['unit-view'].body);
      let unitId = unitMatches && unitMatches.data[0] && unitMatches.data[0].id;

      // Set up the quantity's dependencies and the subrequest to create it
      // first, since the subrequest to create the log will depend upon them.
      const quantityDependencies = [];
      if (!unitId) {
        const unit = farm.term.create({ type: 'unit', name: 'US_gal_acre' });
        subrequests.push({
          requestId: 'unit-create',
          uri: '/api/taxonomy_term/unit',
          action: 'create',
          headers,
          body: JSON.stringify({
            data: transformLocalEntity('taxonomy_term', unit, transforms),
          }),
        });
        quantityDependencies.push('unit-create');
        unitId = '{{unit-create.body@$.id}}';
      }
      const quantity = farm.quantity.create({
        type: 'standard',
        label: 'hhh',
        measure: 'weight',
        units: { type: 'taxonomy_term--unit', id: unitId },
      });
      const quantitySubrequest = {
        requestId: 'quantity-create',
        uri: '/api/quantity/standard',
        action: 'create',
        headers,
        waitFor: quantityDependencies,
        body: JSON.stringify({
          data: transformLocalEntity('quantity', quantity, transforms),
        }),
      };

      // Finally, we can set up the log's dependencies and its own subrequest.
      const logDependencies = ['quantity-create'];
      if (!catId) {
        const cat = farm.term.create({ type: 'log_category', name: 'pest_disease_control' });
        subrequests.push({
          requestId: 'cat-create',
          uri: '/api/taxonomy_term/log_category',
          action: 'create',
          headers,
          body: JSON.stringify({
            data: transformLocalEntity('taxonomy_term', cat, transforms),
          }),
        });
        logDependencies.push('cat-create');
        catId = '{{cat-create.body@$.id}}';
      }
      if (!landId) {
        const land = farm.asset.create({
          type: 'land',
          name: 'west field bed 12',
          land_type: 'bed',
          is_location: true,
        });
        const data = transformLocalEntity('asset', land, transforms);
        subrequests.push({
          requestId: 'land-create',
          uri: '/api/asset/land',
          action: 'create',
          headers,
          body: JSON.stringify({
            data,
          }),
        });
        logDependencies.push('land-create');
        landId = '{{land-create.body@$.id}}';
      }
      if (!userId) {
        const user = farm.user.create({ type: 'user', name: 'farm' });
        subrequests.push({
          requestId: 'user-create',
          uri: '/api/user/user',
          action: 'create',
          headers,
          body: JSON.stringify({
            data: transformLocalEntity('user', user, transforms),
          }),
        });
        logDependencies.push('user-create');
        userId = '{{user-create.body@$.id}}';
      }
      const log = farm.log.create({
        type: 'input',
        name: 'application: hhh 20 US_gal_acre',
        quantity: [{ id: quantity.id, type: 'quantity--standard' }],
        log_category: [{ type: 'taxonomy_term--log_category', id: catId }],
        location: [{ type: 'asset--land', id: landId }],
        owner: [{ type: 'user--user', id: userId }],
      });
      const logSubrequest = {
        requestId: 'log-create',
        uri: '/api/log/input',
        action: 'create',
        headers,
        waitFor: logDependencies,
        body: JSON.stringify({ data: transformLocalEntity('log', log, transforms) }),
      };

      return farm.remote.request('/subrequests?_format=json', {
        method: 'POST',
        data: [
          ...subrequests,
          quantitySubrequest,
          logSubrequest,
        ],
      });
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
