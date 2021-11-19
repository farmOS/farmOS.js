# Entities
As outlined in the [farmOS Data Model](https://docs.farmos.org/model/), there are a few high-level types of records, known as entities, which share some common attributes and can have their own subtype, also referred to as a bundle.

The two primary entities are [Assets](https://docs.farmos.org/model/type/asset/) and [Logs](https://docs.farmos.org/model/type/log/). A few examples of asset bundles would be equipment, plants, animals, land or water. A few examples of log bundles would be activities, harvests, inputs or observations.

In farmOS.js, there are broadly two types of methods for handling entities: write methods, which return a new entity or modified copy of a previously existing entity; and remote methods, which transport entities between the local and a remote system, using an asynchronous request/response pattern.

# Write methods
When you wish to generate new entities or modify existing ones, you should always use a write method, which will provide a degree of immutability by returning a deep clone of the original entity, rather than mutating it in place. Write methods will also track and update the entity's [metadata](/docs/metadata.md), which will significantly simplify how remote operations can be performed.

Each entity has corresponding write methods on its corresponding namespace of the `farm` instance. For example, `farm.log.create` can be used to generate a new farmOS log:

```js
const log = farm.log.create({
  type: 'activity',
  name: 'Weeding in Greenhouse 5',
});
```

The `create` method takes a "props" object, which is required to have a valid `type` property. To be considered valid, `type` must match a log schema previously set using [`farm.schema.set`](/docs/schemata.md#setting-schemata). All other props are optional, but will be set if provided. If not provided, they will be assigned a valid default value. Props that do not match any known fields for that entity type (attributes or relationships), will be ignored.

To update a log, you provide the original log as the first parameter, and an object containing the properties you wish to set as the second parameter. The returned log will have those properties updated, as well as any corresponding metadata.

```js
const updated = farm.log.update(log, {
  name: 'Weeding in Greenhouse 5 and 6',
});
```
Finally, when you wish to merge a local version of the log with its remote copy (ie, a log with the same `type` and identical `id`), you can use the `merge` method:

```js
const merged = farm.log.merge(updated, remoteLog);
```

Corresponding methods exist for all entities, so `farm.asset.create`, `farm.asset.update` and `farm.asset.merge` methods can be used for writing to assets, as well as users, terms, etc.
