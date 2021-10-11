import baseFieldDefaults from './baseFieldDefaults.js';

// When these stubs are replaced, make sure to return an empty array if nullish,
// otherwise make sure to handle nullish relationships (and maybe attributes) in
// create/update/merge methods.
export const getPropertiesStub = entName => (_, fieldType) =>
  Object.keys(baseFieldDefaults[entName][fieldType]);

export const getDefaultStub = entName => (_, fieldType, field) =>
  baseFieldDefaults[entName][fieldType][field];
