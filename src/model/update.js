import { validate } from 'uuid';
import clone from 'ramda/src/clone.js';
import { listProperties } from '../json-schema/index.js';
import { parseTypeFromFields } from '../utils.js';

/**
 * @typedef {import('../entities.js').Entity} Entity
 */
/**
 * Update a farmOS entity.
 * @typedef {Function} updateEntity
 * @param {Entity} entity
 * @param {Object.<String, any>} props
 * @returns {Entity}
 */
/**
 * @param {import('./index.js').BundleSchemata} schemata
 * @returns {updateEntity}
 */
const updateEntity = (schemata) => (entity, props) => {
  const { id } = entity;
  const { entity: entName, bundle, type } = parseTypeFromFields(entity);
  if (!validate(id)) { throw new Error(`Invalid ${entName} id: ${id}`); }
  const schema = schemata[entName] && schemata[entName][bundle];
  if (!schema) { throw new Error(`Cannot find a schema for the ${entName} type: ${type}.`); }

  const now = new Date().toISOString();
  const entityCopy = clone(entity);
  const propsCopy = clone(props);
  const { meta = {} } = entityCopy;
  let { changed = now } = meta;
  const { fieldChanges = {}, conflicts = [] } = meta;
  const updateFields = (fieldType) => {
    const fields = { ...entityCopy[fieldType] };
    listProperties(schema, fieldType).forEach((name) => {
      if (name in propsCopy) {
        fields[name] = propsCopy[name];
        fieldChanges[name] = now;
        changed = now;
      }
    });
    return fields;
  };

  const attributes = updateFields('attributes');
  const relationships = updateFields('relationships');

  return {
    id,
    type,
    attributes,
    relationships,
    meta: {
      ...meta,
      changed,
      fieldChanges,
      conflicts,
    },
  };
};

export default updateEntity;
