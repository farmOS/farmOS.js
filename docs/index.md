# ⚠️ __WARNING__ ⚠️
This is an alpha release, compatible only with farmOS 2.x and __not intended for general use__. Documentation may not be up-to-date in all places and __breaking changes will occur__ until beta release.

# Overview
farmOS.js is a JavaScript library for working with farmOS data structures and interacting with farmOS servers.

# Quick Start
Learn farmOS.js by example.

## 1. Install farmOS.js via npm

```bash
$ npm install farmos
```

## 2. Create a farm instance

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

## 3. Connect to a remote farmOS server

```js
const username = 'Farmer Sam';
const password = '123_you_cant_guess_me';
farm.remote.authorize(username, password);
```

## 4. Retrieve JSON schema for farmOS record types from the server

```js
farm.schema.fetch()
  .then((schemata) => {
    farm.schema.set(schemata);
    localStorage.setItem('farm_schemata', JSON.stringify(schemata));
  });
```

## 5. CRUD operations with a farmOS log

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
