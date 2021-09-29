/* eslint-disable no-param-reassign */
import compose from 'ramda/src/compose.js';
import cond from 'ramda/src/cond.js';
import eqBy from 'ramda/src/eqBy.js';
import equals from 'ramda/src/equals.js';
import has from 'ramda/src/has.js';
import identity from 'ramda/src/identity.js';
import isNil from 'ramda/src/isNil.js';
import map from 'ramda/src/map.js';
import prop from 'ramda/src/prop.js';

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

const mergeEntity = (entName, meta) => (local, remote) => {
  if (local.id !== remote.id) {
    throw new Error(`Cannot merge remote ${entName} (UUID: ${remote.id}) `
      + `with local ${entName} (UUID: ${local.id}).`);
  }
  if (local.type !== remote.type) {
    throw new Error(`Cannot merge remote ${remote.type} ${entName} `
      + `with local ${local.type} ${entName}.`);
  }
  if (!local[meta]) {
    throw new Error(`Cannot merge ${entName} because local metadata is unreadable.`);
  }
  const { lastSync } = local[meta].remote;
  const { meta: { changed: remoteChanged } = {} } = remote;
  // This loop comprises the main algorithm for merging concurrent copies of
  // the entity on separate systems. It depends on the local metadata stored
  // for each field, remote metadata sent with the entity, and the timestamp
  // (lastSync) that local data for this entity was last sent to the remote
  // system. Unfortunately, b/c not all remotes store metadata with the same
  // level of granularity, we can only depend on the `created` field they
  // send, so not all conflicts can be resolved without manual intervention.
  Object.entries(local[meta].fields).forEach(([fieldName, field]) => {
    const { fieldType } = field;
    const fieldsAreEqual = eqFields(fieldType);
    const remoteMetadata = (remote.meta && remote.meta.fields
      && remote.meta.fields[fieldName]) || {};
    const lChange = new Date(field.changed);
    const rChange = new Date(remoteMetadata.changed || remoteChanged || Date.now());
    const lChangeHasBeenSynced = lastSync !== null && new Date(lastSync) > lChange;
    // If the remote entity changed more recently than the local entity, and
    // the local entity was synced more recently than it changed,
    // use the remote entity's value.
    if (rChange > lChange && lChangeHasBeenSynced) {
      field.changed = rChange.toISOString();
      field.data = remote[fieldType][fieldName];
      return;
    }
    // If the local entity changed more recently than the remote entity, or
    // the local entity was synced more recently than the remote entity changed,
    // keep the local entity's value (ie, do nothing).
    if (rChange < lChange || lChangeHasBeenSynced) {
      return;
    }
    // If the remote entity changed since the last sync, while the local entity
    // still has outstanding changes, we have a conflict, so long as the
    // values are not equivalent.
    if (!fieldsAreEqual(remote[fieldType][fieldName], field.data)) {
      field.conflicts.push({
        changed: rChange.toISOString(),
        data: remote[fieldType][fieldName],
      });
    }
    // Otherwise, they are equivalent, so do nothing.
  });
  local[meta].remote.url = remote.links && remote.links.self && remote.links.self.href;
};

export default mergeEntity;
