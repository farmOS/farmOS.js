# Schemata
In order to generate and modify farmOS data structures, your farm instance must have the corresponding schema for each entity type (aka, the "bundle") that you wish to work with. For instance, if you wish to create an activity log and send it to a server, you will need the schema for logs with the type `'activity'`.

These schemata are formatted using the [JSON Schema](https://json-schema.org) specification.

Although this requires an extra degree of complexity, to retrieve and load schemata at runtime, it ensures that independent devices using separate configurations can still share data, so long as they adhere to the farmOS Data Model.

# Setting schemata
To set a schema for a particular entity type, call `farm.schema.set` with the entity and type as the first two parameters, and the JSON Schema itself as the third parameter:

```js
farm.schema.set('log', 'activity', activityLogJSONSchema);
```

Once you have done so, you can create an activity log, which will be given a UUID and valid defaults:

```js
const activity = farm.log.create({ type: 'activity' });
console.log(activity.timestamp) // => '2021-11-16T21:54:54.888Z'
```

Otherwise, if you tried to create an activity without first setting the activity log schema, it would throw an error.

It is also possible to set the schemata for all entities or entity types with a single call to `farm.schema.set`, which can be useful when you are retrieving schemata from a remote farmOS device, or loading cached schemata:

```js
const schemata = {
  log: {
    activity: { /** JSON Schema */ },
    harvest: { /** JSON Schema */ },
    observation: { /** JSON Schema */ },
    // etc...
  },
  asset: {
    animal: { /** JSON Schema */ },
    equipment: { /** JSON Schema */ },
    // etc...
  },
  // etc...
};
farm.schemata.set(schemata);
// Or...
farm.schemata.set('log', schemata.log);
```

One caveat to be aware of, however, is that calls to `farm.schema.set` will overwrite the existing schemata to whatever depth you call the parameters. So if you previously had schemata for harvest logs and equipment assets, but then called:

```js
const activityLogJSONSchema = { /** JSON Schema */ };
farm.schema.set({ log: { activity: activityLogJSONSchema } });
const harvest = farm.log.create({ type: 'harvest' }); // THROWS!
const equipment = farm.asset.create({ type: 'equipment' }); // THROWS!
```

Those calls to create a new harvest log and equipment asset will throw, because the schemata for them are no longer set. To avoid that scenario, it would have been better to call:

```js
farm.schema.set('log', 'activity', activityLogJSONSchema);
const harvest = farm.log.create({ type: 'harvest' }); // works
const equipment = farm.asset.create({ type: 'equipment' }); // works
```

In this last example, only the activity log schema would have been overwritten, preserving the original schemata for harvest logs and equipment assets.

## Instantiate your farm with the `schemata` option
If schemata are available to your application when you instantiate `farmOS`, you can also provide a `schemata` option to the constructor. This option should have as its value an object, containing each entity as a key (eg, `'log'`), whose value is an object containing each entity type as a key (eg, `'activity'`), whose value is the corresponding schema for that entity type.

```js
const myFarm = farmOS({
  schemata: {
    log: {
      activity: { /** JSON Schema */ },
    },
  },
});
```

# Retrieving schemata with the `get` method
It is also possible to retrieve schemata after they've been set, which can be useful for checking supported types before attempting other operations, or generating a list of available entity types that can be displayed to the user.

As with the `set` method, `farm.schema.get` will accept 0, 1 or 2 parameters:

```js
const allSchemata = farm.schema.get();
const logSchemata = farm.schema.get('log');
const activitySchema = farm.schema.get('log', 'activity');
```

A call with no parameters will return an object containing each entity as a key (eg, `'log'`), whose value is an object containing each entity type (eg, `'activity'`), whose value is the corresponding schema for that entity type; a call with only the entity as the first parameter will return an object containing the entity types as keys and their schemata as values; and a call with both the entity and the entity type as parameters will return the raw schema for that entity type.

So after the previous example, if you ran:

```js
console.log('All schemata:\n', allSchemata, '\n');
console.log('Log schemata:\n', logSchemata, '\n');
console.log('Activity schema:\n', activitySchema, '\n');
```

then you would see something in the console like this:

```
All schemata:
{
  log: {
    activity: { /** JSON Schema */ },
    harvest: { /** JSON Schema */ },
    observation: { /** JSON Schema */ },
    // etc...
  },
  asset: {
    animal: { /** JSON Schema */ },
    equipment: { /** JSON Schema */ },
    // etc...
  },
  // etc...
}

Log Schemata:
{
  activity: { /** JSON Schema */ },
  harvest: { /** JSON Schema */ },
  observation: { /** JSON Schema */ },
  // etc...
}

Activity schema:
{
  $id: 'https://api.example.com/schema/log/activity.json',
  type: 'object',
  // etc...
}
```

# Fetching remote schemata
If your ultimate goal is to send data to a farmOS server, the best way to retrieve a schema is to fetch it from that server. This is facilitated by the `farm.schema.fetch` method, which accepts up to 2 arguments and returns a promise for the request:

```js
farm.schema.fetch('log', 'activity').then((schema) => {
  farm.schema.set('log', 'activity', schema);
});
```

As with the `set` and `get` methods, `fetch` can also take an optional first parameter of the entity, and an optional second parameter of the entity type:


```js
farm.schema.fetch('log').then((logSchemata) => {
  farm.schema.set('log', logSchemata);
});
// Or...
farm.schema.fetch().then((allSchemata) => {
  farm.schema.set(allSchemata);
});
```

# Using core schemata
The "core" farmOS schemata, those that are included in a standard installation of a farmOS server, can be imported as JSON files from the farmOS.js Node package, if your bundler supports that JSON loading:

```js
import activityLogJSONSchema from 'farmos/core_schemata/log/activity.json';

farm.schema.set('log', 'activity', activityLogJSONSchema);
```

However, it is recommended that schemata be retrieved from a live server instance, to avoid compatibility issues.
