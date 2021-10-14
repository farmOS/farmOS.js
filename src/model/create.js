import { validate, v4 as uuidv4 } from 'uuid';
import clone from 'ramda/src/clone.js';
import { getPropertiesStub, getDefaultStub } from './schemata/index.js';

const createEntity = (entName, schemata) => (props) => {
  const { id = uuidv4(), type } = props;
  if (!validate(id)) { throw new Error(`Invalid ${entName} id: ${id}`); }
  const schema = schemata[entName][type];
  if (!schema) { throw new Error(`Cannot find a schema for the ${entName} type: ${type}.`); }
  const {
    attributes = {}, relationships = {}, meta = {}, ...rest
  } = clone(props);
  // Spread attr's and rel's like this so other entities can be passed as props,
  // but nesting props is still not required.
  const copyProps = { ...attributes, ...relationships, ...rest };
  const {
    created = new Date().toISOString(),
    changed = created,
    remote: {
      lastSync = null,
      url = null,
      meta: remoteMeta = null,
    } = {},
  } = meta;
  const fieldChanges = {};
  const getProperties = getPropertiesStub(entName); // TODO: Replace stub
  const getDefault = getDefaultStub(entName); // TODO: Replace stub
  const initFields = (fieldType) => {
    const fields = {};
    getProperties(schema, fieldType).forEach((name) => {
      if (name in copyProps) {
        const changedProp = meta.fieldChanges && meta.fieldChanges[name];
        fieldChanges[name] = changedProp || changed;
        fields[name] = copyProps[name];
      } else {
        fieldChanges[name] = changed;
        fields[name] = getDefault(schema, fieldType, name);
      }
    });
    return fields;
  };
  return {
    id,
    type,
    attributes: initFields('attributes'),
    relationships: initFields('relationships'),
    meta: {
      created,
      changed,
      remote: { lastSync, url, meta: remoteMeta },
      fieldChanges,
      conflicts: [],
    },
  };
};

export default createEntity;
