import { validate } from 'uuid';
import clone from 'ramda/src/clone.js';
import compose from 'ramda/src/compose.js';
import cond from 'ramda/src/cond.js';
import eqBy from 'ramda/src/eqBy.js';
import equals from 'ramda/src/equals.js';
import evolve from 'ramda/src/evolve.js';
import has from 'ramda/src/has.js';
import identity from 'ramda/src/identity.js';
import isNil from 'ramda/src/isNil.js';
import map from 'ramda/src/map.js';
import prop from 'ramda/src/prop.js';
import createEntity from './create.js';
import { listProperties } from '../json-schema/index.js';
import { parseTypeFromFields } from '../utils.js';

// Helpers for determining if a set of fields are equivalent. Attributes are
// fairly straightforward, but relationships need to be compared strictly by
// their id(s), b/c JSON:API gives a lot of leeway for how these references
// can be ordered and structured.
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

/**
 * @typedef {import('../entities.js').Entity} Entity
 */
/**
 * Merge a local copy of a farmOS entity with an incoming remote copy. They must
 * share the same id (UUID v4) and type (aka, bundle).
 * @typedef {Function} mergeEntity
 * @param {Entity} [local] If the local is nullish, merging will dispatch to the
 * create method instead, creating a new local copy of the remote entity.
 * @param {Entity} [remote] If the remote is nullish, a clone of the local will be returned.
 * @returns {Entity}
 */
/**
 * @param {import('./index.js').BundleSchemata} schemata
 * @returns {mergeEntity}
 */
const mergeEntity = (schemata) => (local, remote) => {
  if (!remote) return clone(local);
  const now = new Date().toISOString();
  if (!local) {
    // A nullish local value represents the first time a remotely generated
    // entity was fetched, so all changes are considered synced with the remote.
    const resetLastSync = evolve({ meta: { remote: { lastSync: () => now } } });
    return createEntity(schemata)(resetLastSync(remote));
  }
  const { id } = local;
  const { entity, bundle, type } = parseTypeFromFields(local);
  if (!validate(id)) { throw new Error(`Invalid ${entity} id: ${id}`); }
  const schema = schemata[entity] && schemata[entity][bundle];
  if (!schema) {
    throw new Error(`Cannot find a schema for the ${entity} type: ${type}.`);
  }
  const localName = local.attributes && `"${local.attributes.name || ''}" `;
  if (id !== remote.id) {
    throw new Error(`Cannot merge remote ${entity} with UUID ${remote.id} `
      + `and local ${entity} ${localName}with UUID ${id}.`);
  }
  if (local.type !== remote.type) {
    throw new Error(`Cannot merge remote ${entity} of type ${remote.type} `
      + `and local ${entity} ${localName}of type ${local.type}.`);
  }
  if (local.meta.conflicts.length > 0) {
    throw new Error(`Cannot merge local ${entity} ${localName}`
      + 'while it still has unresolved conflicts.');
  }

  // Establish a consistent value for the current time.
  // const now = new Date().toISOString();

  // Deep clone the local & destructure its metadata for internal reference.
  const localCopy = clone(local);
  const {
    meta: {
      fieldChanges: localChanges,
      changed: localChanged = now,
      remote: { lastSync: localLastSync = null },
    },
  } = localCopy;

  // Deep clone the remote & destructure its metadata for internal reference.
  const remoteCopy = clone(remote);
  const {
    meta: {
      fieldChanges: remoteChanges,
      changed: remoteChanged = now,
      remote: { lastSync: remoteLastSync = null },
    },
  } = remoteCopy;

  // These variables are for storing the values that will ultimately be returned
  // as metadata. They are all considered mutable within this function scope and
  // will be reassigned or appeneded to during the iterations of mergeFields, or
  // afterwards in the case of lastSync.
  let changed = localChanged; let lastSync = localLastSync;
  const fieldChanges = {}; const conflicts = [];

  const mergeFields = (fieldType) => {
    const checkEquality = eqFields(fieldType);
    const { [fieldType]: localFields } = localCopy;
    const { [fieldType]: remoteFields } = remoteCopy;
    // Spread localFields so lf.data and lf.changed aren't mutated when fields is.
    const fields = { ...localFields };
    // This loop comprises the main algorithm for merging changes to concurrent
    // versions of the same entity that may exist on separate systems. It uses a
    // "Last Write Wins" (LWW) strategy, which applies to each field individually.
    listProperties(schema, fieldType).forEach((name) => {
      const lf = { // localField shorthand
        data: localFields[name],
        changed: localChanges[name] || localChanged,
      };
      const rf = { // remoteField shorthand
        data: remoteFields[name],
        changed: remoteChanges[name] || remoteChanged,
      };
      const localFieldHasBeenSent = !!localLastSync && localLastSync > lf.changed;
      // Use the local changed value as our default.
      fieldChanges[name] = lf.changed;
      // If the remote field changed more recently than the local field, and the
      // local was synced more recently than it changed, apply the remote changes.
      if (rf.changed > lf.changed && localFieldHasBeenSent) {
        fields[name] = rf.data;
        fieldChanges[name] = rf.changed;
        // Also update the global changed value if the remote field changed more recently.
        if (rf.changed > localChanged) ({ changed } = rf);
      }
      // If the remote field changed more recently than the local field, and the
      // local entity has NOT been synced since then, there may be a conflict.
      if (rf.changed > lf.changed && !localFieldHasBeenSent) {
        // Run one last check to make sure the data isn't actually the same. If
        // they are, there's no conflict, but apply the remote changed timestamps.
        if (checkEquality(lf.data, rf.data)) {
          fieldChanges[name] = rf.changed;
          if (rf.changed > localChanged) ({ changed } = rf);
        } else {
          // Otherwise keep the local values, but add the remote changes to the
          // list of conflicts.
          conflicts.push({
            fieldType,
            field: name,
            changed: rf.changed,
            data: rf.data,
          });
        }
      }
      // In all other cases, the local values will be retained.
    });
    return fields;
  };

  const attributes = mergeFields('attributes');
  const relationships = mergeFields('relationships');

  // These tests will set the lastSync value to the current timestamp if any one
  // of the following criteria can be met: 1) a remote entity is being merged
  // with a local entity whose changes have already been sent to that remote,
  // 2) the merge occurs after the very first time a locally generated entity
  // was sent to the remote system, 3) all changes from the remote have been
  // fetched since the most recent local change. Otherwise, the local lastSync
  // value will be retained.
  const localChangesHaveBeenSent = !!localLastSync && localLastSync >= localChanged;
  const remoteIsInitialSendResponse = !localLastSync && !!remoteLastSync;
  const remoteChangesHaveBeenFetched = !!remoteLastSync && remoteLastSync >= localChanged;
  const syncHasCompleted = localChangesHaveBeenSent
    || remoteIsInitialSendResponse
    || remoteChangesHaveBeenFetched;
  if (syncHasCompleted) lastSync = now;

  return {
    id,
    type,
    attributes,
    relationships,
    meta: {
      ...localCopy.meta,
      changed,
      fieldChanges,
      conflicts,
      remote: {
        ...remoteCopy.meta.remote,
        lastSync,
      },
    },
  };
};

export default mergeEntity;
