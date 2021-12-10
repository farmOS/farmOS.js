# Entities

## farmOS's core data structures
As outlined in the [farmOS Data Model](https://docs.farmos.org/model/), there are a few high-level types of records, known as entities, which share some common attributes and can have their own subtype, also referred to as a bundle. These entities comprise the main data structures in farmOS domain model.

The two primary entities are [Assets](https://docs.farmos.org/model/type/asset/) and [Logs](https://docs.farmos.org/model/type/log/). A few examples of asset bundles would be equipment, plants, animals, land or water. A few examples of log bundles would be activities, harvests, inputs or observations.

In farmOS.js, there are broadly two types of methods for handling entities: write methods, which return a new entity or modified copy of a previously existing entity; and remote methods, which transport entities between the local and a remote system, using an asynchronous request/response pattern.

## Write methods
When you wish to generate new entities or modify existing ones, you should always use a write method, rather than mutating it in place. Write methods will provide a degree of immutability by returning a deep clone of the original entity. Although it will still be possible to reassign properties of that clone, it is not recommended. Largely this is because write methods will also track and update the entity's [metadata](/docs/metadata.md), which will significantly simplify how remote operations can be performed.

Each entity has corresponding write methods on its corresponding namespace of the `farm` instance. For example, `farm.log.create` can be used to generate a new farmOS log:

```js
const log = farm.log.create({
  type: 'activity',
  name: 'Weeding in Greenhouse 5',
});
```

The `create` method takes a "props" object, which is required to have a valid `type` property. To be considered valid, this `type` must match a log schema previously set using [`farm.schema.set`](/docs/schemata.md#setting-schemata). All other props are optional, but should correspond to a valid attribute or relationship for that entity type, as defined by its schema. If a prop does not match the schema, it will be ignored. An `id` prop will also be accepted as long as it is a valid UUID (v4). Wherever an attribute or relationship in the entity's schema cannot be matched with a prop, a default will be assigned instead.

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

## Fetching entities
If you've already [configured a remote host](remotes.md#configuring-the-host) and [authorized a user](remotes.md#authorizing-a-user), you can exchange entities with that host via AJAX. There are three remote methods for each entity, on the same namespace as the write methods: `fetch`, `send` and `delete`. All remote methods are asynchronous, and use the [axios](https://axios-http.com/) HTTP client internally, so they will work the same in both browser and Node.js environments.

The fetch method can be called without parameters, although it is not recommended for reasons that will be outlined below:

```js
const request = farm.asset.fetch();
```

The request above will in fact represent a chain of HTTP requests, at least one for every asset type that has been previously set on the farm instance. These requests are aggregated and resolve to a single object, containing three properties: `data`, which will be an array of all the assets retrieved in the course of all underlying requests; `fulfilled`, an array of all successful [responses objects](https://axios-http.com/docs/res_schema), unaltered; and `rejected`, an array of all [failed requests](https://axios-http.com/docs/handling_errors), also unaltered.

Since the `fetch` call above was passed no options, however, the result object could include an arbitrary number of results. In some cases, however rare (see details on the [`limit`](#limiting-fetch-requests) option below), this could be years worth of the assets of all types, both active an inactive, stored on the remote database, yet it still may be an incomplete collection of the assets you wished to retrieve.

For this reason, it's recommended to use some combination of options as an object parameter passed to the `fetch` method. The options currently supported are:

- `filter`
- `limit`

### Filtering fetch requests
A `filter` option can be provided to the `fetch` method, which is a [MongoDB-style query selector](https://docs.mongodb.com/manual/reference/operator/query/), supporting the following operators:

- Logical operators
  - `$and`
  - `$or`
- Comparison Operators
  - `$eq`
  - `$gt`
  - `$gte`
  - `$in`
  - `$lt`
  - `$lte`
  - `$ne`
  - `$nin`

So for example, to request completed activity logs, you could use the following request:

```js
const filter = {
  type: { $eq: 'activity' },
  status: { $eq: 'done' },
};
const request = farm.log.fetch({ filter });
```

Generally speaking, it's a good idea to include the `type` in filter queries whenever possible. In some instances, though, you may want to broaden the scope to include multiple types, which can be achieved with the `$or` operator:

```js
const filter = {
  type: {
    $or: [
      { $eq: 'activity' },
      { $eq: 'harvest' },
      { $eq: 'input' },
    ],
  },
  status: { $eq: 'done' },
};
```

This can be abbreviated somewhat by omitting the `$or` operator, and simply assigning the value of the array to the `type` property:

```js
const filter = {
  type: [
    { $eq: 'activity' },
    { $eq: 'harvest' },
    { $eq: 'input' },
  ],
  status: { $eq: 'done' },
};
```

And of course, a even more common shorthand is to omit the `$eq` operators, merely assigning the property to the value it should be equivalent to:

```js
const filter = {
  type: ['activity', 'harvest', 'input'],
  status: 'done',
};
```

As you can see, this works even for the elements of the array, which have been reduced to simple strings, rather than the previous objects. The `$or` and `$eq` are therefore considered __implicit operators__. Another implicit operator is the `$and` operator, which is essentially present wherever there is object notation. In fact, the `filter` object itself is shorthand for:

```js
const filter = {
  $and: [
    { type: ['activity', 'harvest', 'input'] },
    { status: 'done' },
  ],
};
```

Clearly, this is unnecessary and verbose, but it is helpful to keep this in mind when structuring complex queries.

A final form of syntactic sugar supported by filter queries is __dot notation__. A good use case for this is where you want to retrieve all logs that have the same owner. Logs can have multiple owners, so the `owner` relationship is represented by an array of objects with the user's `id` property. To select a log with a specific user as one of its owners, you could provide the following query:

```js
const filter = {
  type: 'activity',
  'owner.id': '22222222-2222-2222-2222-222222222222',
};
```
This query would match a log such as the following, represented as a JavaScript object:

```js
const log = {
  id: '00000000-0000-0000-0000-000000000000',
  type: 'activity',
  attributes: {/** ... */},
  relationships: {
    // ...
    owner: [
      { type: 'user', id: '11111111-1111-1111-1111-111111111111' },
      { type: 'user', id: '22222222-2222-2222-2222-222222222222' },
      { type: 'user', id: '33333333-3333-3333-3333-333333333333' },
    ],
    // ...
  },
}
```

This is a good place to note, too, that query fields should not be nested within the `attributes` or `relationships` objects, even though the corresponding entity field may be so nested.

### Limiting fetch requests
All the above filters, however, may not be sufficient to retrieve _all_ of activity logs that match the provided query. More likely than not, they will only retrieve the first 50 logs that match, assuming there are as many logs on the server. That's because the default configuration for farmOS servers, at the time of writing this, sets a hard limit of 50 results per page, which can only be changed at the server; clients cannot override it remotely.

It's also important to note that this limit will apply separately for each entity bundle (aka, `type`) being requested. So the example query from above,

```js
const filter = {
  $and: [
    { type: ['activity', 'harvest', 'input'] },
    { status: 'done' },
  ],
};
const request = farm.log.fetch({ filter });
```

would at most return 150 logs. farmOS.js, however, can chain together successive requests until a given `limit` option is reached:

```js
const request = farm.log.fetch({ filter, limit: 200 });
```

The `limit` option is must be an [integer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isInteger) greater than or equal to `0`, or [`Infinity`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Infinity). So to fetch all logs that match your query:

```js
const request = farm.log.fetch({ filter, limit: Infinity })
```

It's especially important, when using a `limit` of `Infinity`, to combine it with a reasonable filter query, to keep the duration of the request cycle as short as possible, or to otherwise be prepared to accommodate long cycles without degrading performance or user experience.

## Sending and deleting entities
Sending entities to a remote server is much more straightforward in comparison:

```js
const tractor = farm.asset.create({ type: 'equipment', name: 'Farmall H' });
farm.asset.send(tractor);
```

The same `send` method can be used for a locally generated entity that's being sent to the server for the first time (as a `POST` request), or to update an existing entity on that server (as a `PATCH` request).

To delete an entity remotely, you just need to provide the entity's bundle (aka, `type`) and its `id` as the first and second parameters of the `delete` method, respectively:

```js
farm.asset.delete('equipment', tractor.id);
```
