# Introduction

## Motivation
farmOS.js is a JavaScript library for working with farmOS data structures and interacting with farmOS servers.

The need for farmOS.js arose out of development of the farmOS Field Kit app, which required the ability to work offline and to work with farmOS servers in varying configurations that could only be determined at runtime. To solve this, farmOS.js retrieves and stores [JSON Schema](https://json-schema.org/) documents from the servers it connects to. It then uses these schemata to generate farmOS data structures according to each server's particular configuration to ensure they will be validated by that server. To resolve the conflicts that inevitably arise from storing and modifying concurrent data while offline, farmOS.js implements a ["last-write-wins" merging strategy](metadata.md#last-write-wins-lww), so synchronization can be handled more fluidly and intuitively.

Altogether, this has led farmOS.js to develop into a system with robust support for high degrees of both __modularity__ and __concurrency__, opening up the potential for the development of a wider array of interoperable applications.

## Requirements & browser support
farmOS.js supports the [farmOS 2.x Data Model](https://docs.farmos.org/model/), compatible with farmOS 2.x servers. Previous versions will no longer be supported.

farmOS.js can run in Node.js (versions 12.9.0 or higher), and in most modern browsers. IE 11 is not supported.

## Quick Start
Learn farmOS.js by example.

### 1. Install farmOS.js via npm

```bash
$ npm install farmos
```

### 2. Create a farm instance

```js
import farmOS from 'farmos';

let token;
const options = {
  remote: {
    host: 'https://farm.example.com',
    clientId: 'farm_client',
    getToken: () => token,
    setToken: (t) => { token = t; },
  },
};
const farm = farmOS(options);
```

### 3. Connect to a remote farmOS server

```js
const username = 'Farmer Sam';
const password = '123_you_cant_guess_me';
farm.remote.authorize(username, password);
```

### 4. Retrieve JSON schema for farmOS record types from the server

```js
farm.schema.fetch()
  .then((schemata) => {
    farm.schema.set(schemata);
    localStorage.setItem('farm_schemata', JSON.stringify(schemata));
  });
```

### 5. CRUD operations with a farmOS log

```js
const initProps = { type: 'activity', name: 'did some stuff' };
const activity = farm.log.create(initProps);
const { id } = activity; // `id` is a v4 UUID
farm.log.send(activity)
  .then(() => farm.log.fetch({ filter: { type: 'activity', id } }))
  .then(({ data: [remoteActivity] }) => {
    const updateProps = { name: 'did some more stuff' };
    const updatedActivity = farm.log.update(activity, updateProps);
    // Merge operations use a "Last-Write-Wins" (LWW) concurrency strategy.
    const mergedActivity = farm.log.merge(updatedActivity, remoteActivity);
    return farm.log.delete('activity', id);
  });
```

## Next steps
Now that you know the basics, dive deeper into following topics:

- [Using farmOS JSON Schema documents](schemata.md)
- [Connecting to a farmOS server](remotes.md)
- [Working with farmOS entities](entities.md)
- [Handling farmOS metadata](metadata.md)
  
Or, go straight to the [API reference](api.md).
