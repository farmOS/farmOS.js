import baseFieldDefaults from './baseFieldDefaults.js';

export const getPropertiesStub = entName => (_, fieldType) =>
  Object.keys(baseFieldDefaults[entName][fieldType]);

export const getDefaultStub = entName => (_, fieldType, field) =>
  baseFieldDefaults[entName][fieldType][field];
