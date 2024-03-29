const farmOS = require('../dist/cjs/farmOS').default;
const localServerConfig = require('../test/local-server-config.js');
const { writeSchema } = require('./fs-utils.js');

const $idURI = (entity, bundle) =>
  // Eventually, this should point to a location on farmos.org or docs.farmos.org
  `https://raw.githubusercontent.com/farmOS/farmOS.js/main/core_schemata/${entity}/${bundle}.json`;

const makeReplacer = (entity, bundle) => (key, value) => {
  if (key === '$id' && value.includes('localhost')) {
    return $idURI(entity, bundle);
  }
  return value;
};

const {
  host, clientId, username, password,
} = localServerConfig;
const farm = farmOS({
  remote: { host, clientId },
});

farm.remote.authorize(username, password)
  .then(() => farm.schema.fetch())
  .then((schemata) => {
    Object.entries(schemata).forEach(([entity, bundles]) => {
      Object.entries(bundles).forEach(([bundle, schema]) => {
        const replacer = makeReplacer(entity, bundle);
        writeSchema(entity, bundle, schema, replacer, 2);
      });
    });
  });
