import { validate } from 'uuid';
import clone from 'ramda/src/clone.js';
import compose from 'ramda/src/compose.js';
import cond from 'ramda/src/cond.js';
import eqBy from 'ramda/src/eqBy.js';
import equals from 'ramda/src/equals.js';
import has from 'ramda/src/has.js';
import identity from 'ramda/src/identity.js';
import isNil from 'ramda/src/isNil.js';
import map from 'ramda/src/map.js';
import prop from 'ramda/src/prop.js';
import createEntity from './create.js';
import { getPropertiesStub } from './schemata/index.js';

// Helpers for determining if a set of fields are equivalent. Attributes are
// fairly straightforward, but relationships need to be compared strictly by
// their id(s), b/c JSON:API gives a lot of leeway for how these references
// can be structured.
const setOfIds = compose(
  array => new Set(array),
  map(prop('id')),
);
const relsTransform = cond([
  [isNil, identity],
  [Array.isArray, setOfIds],
  [has('id'), prop('id')],
]);
const eqFields = fieldType =>
  (fieldType === 'relationships' ? eqBy(relsTransform) : equals);

const mergeEntity = (entName, schemata) => (local, remote) => {
  const localCopy = clone(local);
  if (!remote) return localCopy;
  if (!local) return createEntity(entName, schemata)(remote);
  const { id, type } = localCopy;
  if (!validate(id)) { throw new Error(`Invalid ${entName} id: ${id}`); }
  const schema = schemata[entName][type];
  if (!schema) {
    throw new Error(`Cannot find a schema for the ${entName} type: ${type}.`);
  }
  const localName = localCopy.attributes && `"${localCopy.attributes.name || ''}" `;
  if (id !== remote.id) {
    throw new Error(`Cannot merge remote ${entName} with UUID ${remote.id} `
      + `and local ${entName} ${localName}with UUID ${id}.`);
  }
  if (localCopy.type !== remote.type) {
    throw new Error(`Cannot merge remote ${entName} of type ${remote.type} `
      + `and local ${entName} ${localName}of type ${localCopy.type}.`);
  }
  if (localCopy.meta.conflicts.length > 0) {
    throw new Error(`Cannot merge local ${entName} ${localName}`
      + 'while it still has unresolved conflicts.');
  }

  const remoteCopy = clone(remote);
  const now = new Date().toISOString();
  let { meta: { changed = now } } = localCopy;
  const fieldChanges = {}; const conflicts = [];

  const getProperties = getPropertiesStub(entName); // TODO: Replace stub
  const mergeFields = (fieldType) => {
    const checkEquality = eqFields(fieldType);
    const {
      [fieldType]: localFields,
      meta: { fieldChanges: localChanges, remote: { lastSync } },
    } = localCopy;
    const {
      [fieldType]: remoteFields,
      meta: { fieldChanges: remoteChanges, changed: remoteChanged = now },
    } = remoteCopy;
    const fields = { ...localFields };
    // This loop comprises the main algorithm for merging changes to concurrent
    // versions of the same entity that may exist on separate systems. It uses a
    // "Last Write Wins" (LWW) strategy, which applies to each field individually.
    getProperties(schema, fieldType).forEach((name) => {
      const l = { data: localFields[name], changed: localChanges[name] || changed };
      const r = { data: remoteFields[name], changed: remoteChanges[name] || remoteChanged };
      const localChangeHasBeenSynced = !!lastSync && lastSync > l.changed;
      // Use the local changed value as our default.
      fieldChanges[name] = l.changed;
      // If the remote field changed more recently than the local field, and the
      // local was synced more recently than it changed, apply the remote changes.
      if (r.changed > l.changed && localChangeHasBeenSynced) {
        fields[name] = r.data;
        fieldChanges[name] = r.changed;
        // Also update the global changed value if the remote field changed more recently.
        if (r.changed > changed) ({ changed } = r);
      }
      // If the remote field changed more recently than the local field, and the
      // local entity has NOT been synced since then, there may be a conflict.
      if (r.changed > l.changed && !localChangeHasBeenSynced) {
        // Run one last check to make sure the data isn't actually the same. If
        // they are, there's no conflict, but apply the remote changed timestamps.
        if (checkEquality(l.data, r.data)) {
          fieldChanges[name] = r.changed;
          if (r.changed > changed) ({ changed } = r);
        } else {
          // Otherwise keep the local values, but add the remote changes to the
          // list of conflicts.
          conflicts.push({
            fieldType,
            field: name,
            changed: r.changed,
            data: r.data,
          });
        }
      }
      // In all other cases, the local values will be retained.
    });
    return fields;
  };

  return {
    id,
    type,
    attributes: mergeFields('attributes'),
    relationships: mergeFields('relationships'),
    meta: {
      ...localCopy.meta,
      changed,
      fieldChanges,
      conflicts,
      remote: {
        ...remoteCopy.meta.remote,
        lastSync: now,
      },
    },
  };
};

export default mergeEntity;
