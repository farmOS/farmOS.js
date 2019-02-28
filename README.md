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
Assets are any piece of property or durable good that belongs to the farm, such as a piece of equipment, a specific crop, or an animal.

Here is an example of what one would look like as a JavaScript object:

```js
{
  field_farm_date: null,
  field_farm_description: [],
  field_farm_files: [],
  field_farm_images: [],
  field_farm_parent: [],
  field_farm_animal_castrated: false,
  field_farm_animal_nicknames: [],
  field_farm_animal_sex: 'F',
  field_farm_animal_tag: [],
  field_farm_animal_type: {
    uri: 'http://localhost/taxonomy_term/12',
    id: '12',
    resource: 'taxonomy_term'
  },
  id: '1',
  name: 'Brunhilde',
  type: 'animal',
  uid: {
    uri: 'http://localhost/user/1',
    id: '1',
    resource: 'user'
  },
  created: '1546031503',
  changed: '1546031947',
  archived: '0',
  url: 'http://localhost/farm/animal/brunhilde',
  feeds_item_guid: null,
  feeds_item_url: null,
  feed_nid: null
}
```

Methods for getting, sending and deleting assets are namespaced on the `farm.asset` property.

#### `.get()`
Use the `.get()` method to retrieve a single asset as a JavaScript object, or an array of asset objects, which can be filtered:
```js
// Leave the parameter undefined to fetch all available assets
farm.asset.get()
  .then(res => console.log(`Asset #${res[0].id} is called ${res[0].name}`))

// Accepts a number for the id of the assets you wish to fetch
farm.asset.get(123)
  .then(res => console.log(`Asset #123 is called ${res.name}`))

// Pass an options object to filter the results
farm.asset.get({
  page: 2, // default === null
  type: 'animal', // default === ''
  archived: true, // default === false
}).then(res => console.log(`Asset #${res[0].id} is called ${res[0].name}`))

```
The options object can have two properties: `page` is the page number in the sequence of paginated results, starting from 0 and in batches of 100 assets; `archived` is a boolean which determines whether to retrieve assets which the user has chosen to archive; `type` filters the results by asset type.

The four main asset types are:
- `animal`
- `compost`
- `equipment`
- `planting`

#### `.send()`
Send can be used to create a new asset, or if the `id` property is included, to update an existing asset:
```js
farm.asset.send(asset, token)
  .then(res => console.log(`Asset was assigned an id of ${res.id}`));
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
