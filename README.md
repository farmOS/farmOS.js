# farmOS.js

[![Licence](https://img.shields.io/badge/Licence-GPL%203.0-blue.svg)](https://opensource.org/licenses/GPL-3.0/)
[![Last commit](https://img.shields.io/github/last-commit/farmOS/farmOS.js.svg?style=flat)](https://github.com/farmOS/farmOS-client/commits)
[![Twitter](https://img.shields.io/twitter/follow/farmOSorg.svg?label=%40farmOSorg&style=flat)](https://twitter.com/farmOSorg)
[![Chat](https://img.shields.io/matrix/farmOS:matrix.org.svg)](https://riot.im/app/#/room/#farmOS:matrix.org)

An npm package for fetching data from a farmOS server.

## Installation
...

## Usage

To create an instance of farmOS.js:

```js
import farmOS from 'farmos';

const host = 'https://farm.example.com';
const username = 'FarmerSteve';
const password = 'XXXXXXXXXXX';
const farm = farmos(host, username, password);
```

### Authentication
#### `.authenticate()`
```js
farm.authenticate()
  .then(token => localStorage.setItem('token', token));
```

### Logs

A log is any type of event that occurs on the farm, from a planting to a harvest to just a general observation.

Here is an example of what one would look like as a JS object:
```js
const log = {
  field_farm_files: [],
  field_farm_images: [],
  field_farm_area: [],
  field_farm_asset: [],
  field_farm_geofield: [],
  field_farm_inventory: [],
  field_farm_log_category: [],
  field_farm_log_owner: [
    {
      uri: 'http://localhost/user/1',
      id: '1',
      resource: 'user'
    }
  ],
  field_farm_notes: {
    value: '<p>some notes</p>\n',
    format: 'farm_format'
  },
  field_farm_quantity: [],
  id: '1',
  name: 'some log name',
  type: 'farm_observation',
  uid: {
    uri: 'http://localhost/user/1',
    id: '1',
    resource: 'user'
  },
  timestamp: '1519423702',
  created: '1519423702',
  changed: '1519423744',
  done: '1',
  url: 'http://localhost/log/1',
  feeds_item_guid: null,
  feeds_item_url: null,
  feed_nid: null
},
{
  field_farm_files: [],
  field_farm_images: [],
  field_farm_area: [],
  field_farm_asset: [],
  field_farm_geofield: [],
  field_farm_inventory: [],
  field_farm_log_category: [
    {
      uri: 'http://localhost/taxonomy_term/4',
      id: '4',
      resource: 'taxonomy_term'
    }
  ],
  field_farm_log_owner: [
    {
      uri: 'http://localhost/user/1',
      id: '1',
      resource: 'user'
    }
  ],
  field_farm_notes: [],
  field_farm_quantity: [
    {
      uri: 'http://localhost/field_collection_item/1',
      id: '1',
      resource: 'field_collection_item'
    }
  ],
  id: '2',
  name: 'Observation: 03/15/2018 - 00:57',
  type: 'farm_observation',
  uid: {
    uri: 'http://localhost/user/1',
    id: '1',
    resource: 'user'
  },
  timestamp: '1521089821',
  created: '1521089821',
  changed: '1521090017',
  done: '0',
  url: 'http://localhost/log/2',
  feeds_item_guid: null,
  feeds_item_url: null,
  feed_nid: null
};
```

Methods for getting, sending and deleting logs are namespaced on the `farm.log` property.

#### `.get()`
Use the `.get()` method to retrieve a single log as a JavaScript object, or an array of objects, which can be filtered:
```js
// Leave the parameter undefined to fetch all available logs
farm.log.get()
  .then(res => console.log(`Log #${res[0].id} is called ${res[0].name}`))

// Accepts a number for the id of the log you wish to fetch
farm.log.get(123)
  .then(res => console.log(`Log #123 is called ${res.name}`))

// Pass an options object to filter the results
farm.log.get({
  page: 2, // default === null
  type: 'farm_observation', // default === ''
}).then(res => console.log(`Log #${res[0].id} is called ${res[0].name}`))

```
The options object can have two properties: `page` is the page number in the sequence of paginated results, starting from 0 and in batches of 100 logs; `type` filters the results by log type.

The four main log types are:
- `farm_activity`
- `farm_harvest`
- `farm_input`
- `farm_observation`

#### `.send()`
Send can be used to create a new log, or if the `id` property is included, to update an existing log:
```js
farm.log.send(log, token)
  .then(res => console.log(`Log was assigned an id of ${res.id}`));
```

#### `.delete()`
```js
```


### Assets
#### `.get()`
```js
```
#### `.send()`
```js
```
#### `.delete()`
```js
```


### Areas
#### `.get()`
```js
```
#### `.send()`
```js
```
#### `.delete()`
```js
```


### Farm & User Information
#### `.info()`
```js
```


## MAINTAINERS

Current maintainers:
 * Jamie Gaehring - https://jgaehring.com

This project has been sponsored by:
 * [Farmier](http://farmier.com)
 * [Foundation for Food & Agriculture Research(FFAR)](https://foundationfar.org/)
