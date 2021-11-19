# Metadata
An important feature of farmOS.js is the way it manages metadata for farmOS data structures. This is of primary importance for easing synchronization and mitigating conflicts when farmOS data may reside on two or more independent devices that can make concurrent changes to that data.

The basic structure of any farmOS entity will look something like the following object, which would be accessed on the `.meta` property:

```js
const meta = {
  created: '2021-11-16T21:54:54.888Z',
  changed: '2021-11-16T21:54:54.888Z',
  fieldChanges: {
    name: '2021-11-16T21:54:54.888Z',
    asset: '2021-11-16T21:54:54.888Z',
    // etc...
  },
  conflicts: [
    {
      fieldType: 'attribute',
      field: 'name',
      changed: '2021-12-16T21:54:54.888Z',
      data: 'New name from the remote',
    },
  ],
  remote: {
    lastSync: '',
    url: 'https://farm.example.com/log/42',
    meta: {},
  },
}
```

The `created` and `changed` values store timestamps in ISO 8601 format that record changes for the entity as a whole, but to provide finer granularity the `fieldChanges` metadata provides timestamps for the last time a change was made to each attribute and relationship contained in the entity. This is the point of comparison for determining how to resolve a conflict between local and remote copies of an entity when the `merge` method is called, using the ["last write wins"](#last-write-wins-lww) strategy.

If a conflict cannot be resolved automatically during a merge, the remote data will be store in the `conflicts` metadata, while the local field remains unchanged. See below for more details on [how to resolve](#resolving-conflicts) such conflicts.

Finally, the `remote` metadata contains information specific to a particular remote connection to another source of farmOS data.

## Last-Write-Wins (LWW)
The strategy employed for resolving conflicts between a local and remote copy of the same entity (ie, two entities of the same entity type and identical `id`'s), is what's called "last write wins" or LWW. This is a fairly simple algorithm to implement, which essentially uses what metadata is available to determine which value changed most recently, and selects the most recent.

There are limitations to this approach, however, since it can only detect changes down to the field level, which is sufficient for primitive value types like booleans or integers, but fails to capture subtler changes to complex data types. For instance, if an original string of `"Hi my namw is Sam"` was changed locally to `"Hi my name is Joe"`, but remotely changed to `"Hi my name is Sam."`, a plain LWW on the field-level cannot merge those changes, as obvious as they may be to human eyes, so it will generate a conflict which will require some other intervention.

It's also important to note that farmOS Drupal servers do not currently record changes on that level of granularity, only storing `created` and `changed` values for the entity as a whole. It does make up for this, however, by storing full revision history for all entities.

Finally, there may be occasions when "first write wins" would be more appropriate, or some other criteria entirely, depending on a field's particular meaning and significance, but for now LWW is the strategy used for all fields.

Other options exist that might refine our merging strategy, such as [CRDT's](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type), but so far such an approach has yet to be implemented.

# Resolving conflicts
When a conflict does occur, it can be detected as a non-zero length on the `conflicts` array. Note, too, that `merge` operations will not be permitted on entities that have any outstanding conflicts, although `update` operations will be allowed.

To resolve a conflict, you can use the `farm.meta.resolve` method, which takes the entity with the conflict, the field you wish to resolve, and a callback, which receives an array of all the conflicts for that field, and must return the index of the conflict to select, or `-1` if the local value is to be preserved.

# Sync status
The `farm.isUnsynced` method is a quick way of determining whether or not an entity has been synced to a remote system:

```js
const merged = farm.log.merge(local, remote);
const hasUnsyncedChanges = farm.meta.isUnsynced(merged);
```

This is essentially a shorthand for comparing whether the log's `changed` metadata is greater than its `lastSync` metadata, or if `lastSync` is `null`, returning `true` in both instances, or `false` if `changed` is less than or equal to `lastSync`.

Note that the `merge` method will always set the lastSync value of the merged entity to the current timestamp if any one of the following criteria can be met:

1) The merge occurs after the very first time a locally generated entity was sent to the remote system.
2) A remote entity is being merged with a local entity whose changes have already been sent to that remote.
3) All changes from the remote have been fetched since the most recent local change.

Otherwise, the local lastSync value will be retained.

