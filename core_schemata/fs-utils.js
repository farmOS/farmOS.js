const { readFileSync, writeFileSync } = require('fs');

const readSchema = (entity, bundle) => {
  const fileURI = `core_schemata/${entity}/${bundle}.json`;
  const json = readFileSync(fileURI);
  return JSON.parse(json);
};

const writeSchema = (entity, bundle, schema, replacer, space) => {
  const fileURI = `core_schemata/${entity}/${bundle}.json`;
  const json = JSON.stringify(schema, replacer, space);
  writeFileSync(fileURI, json);
};

module.exports = { readSchema, writeSchema };
