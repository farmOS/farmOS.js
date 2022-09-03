import compose from 'ramda/src/compose';
import match from 'ramda/src/match';

// Normalize the entity type.
const entityTypeRegEx = /(\w+)--(\w+)/;
export const parseEntityType = compose(
  ([type, entity, bundle]) => ({ type, entity, bundle }),
  match(entityTypeRegEx),
);
export function parseTypeFromFields(fields = {}) {
  let { entity, bundle, type } = fields;
  if (type) ({ entity, bundle } = parseEntityType(type));
  if (!type && entity && bundle) type = `${entity}--${bundle}`;
  return { entity, bundle, type };
}
