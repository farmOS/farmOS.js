import { readFileSync } from 'fs';

export const loadSchema = (entity, bundle) => {
  const fileURI = `core_schemata/${entity}/${bundle}.json`;
  const json = readFileSync(fileURI);
  return JSON.parse(json);
};

const coreBundles = {
  asset: [
    'equipment',
  ],
  log: [
    'activity',
  ],
  plan: [
    // no plans yet
  ],
  quantity: [
    'standard',
  ],
  taxonomy_term: [
    'unit',
  ],
  user: [
    'user',
  ],
};

export const loadCoreBundleSchemata = (entity) => {
  if (entity in coreBundles) {
    return coreBundles[entity].reduce((schemata, bundle) => ({
      ...schemata,
      [bundle]: loadSchema(entity, bundle),
    }), {});
  }
  return {};
};
