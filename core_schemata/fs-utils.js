import { readFileSync, writeFileSync } from 'fs';

export const readSchema = (entity, bundle) => {
  const fileURI = `core_schemata/${entity}/${bundle}.json`;
  const json = readFileSync(fileURI);
  return JSON.parse(json);
};

export const writeSchema = (entity, bundle, schema, replacer, space) => {
  const fileURI = `core_schemata/${entity}/${bundle}.json`;
  const json = JSON.stringify(schema, replacer, space);
  writeFileSync(fileURI, json);
};
