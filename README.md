# farmOS.js

[![Licence](https://img.shields.io/badge/Licence-GPL%203.0-blue.svg)](https://opensource.org/licenses/GPL-3.0/)
[![Last commit](https://img.shields.io/github/last-commit/farmOS/farmOS.js.svg?style=flat)](https://github.com/farmOS/farmOS-client/commits)
[![Twitter](https://img.shields.io/twitter/follow/farmOSorg.svg?label=%40farmOSorg&style=flat)](https://twitter.com/farmOSorg)
[![Chat](https://img.shields.io/matrix/farmOS:matrix.org.svg)](https://riot.im/app/#/room/#farmOS:matrix.org)

An npm package for fetching data from a farmOS server.

- [Installation](#installation)
- [Usage](#usage)
  - [Logs](#logs)
    - [`.get()`](#get)
    - [`.send()`](#send)
    - [`.delete()`](#delete)
  - [Assets](#assets)
    - [`.get()`](#get-1)
    - [`.send()`](#send-1)
    - [`.delete()`](#delete-1)
  - [Areas](#areas)
    - [`.get()`](#get-2)
    - [`.send()`](#send-2)
    - [`.delete()`](#delete-2)
  - [Farm & User Information](#farm--user-information)
    - [`.info()`](#info)

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
}
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
__THIS METHOD HAS NOT BEEN FULLY DEVELOPED YET AND MAY NOT WORK__
```js
// For now, just an example of what it should look like eventually
farm.log.delete(123, token);
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
__THIS METHOD HAS NOT BEEN FULLY DEVELOPED YET AND MAY NOT WORK__
```js
// For now, just an example of what it should look like eventually
farm.asset.delete(123, token);
```


### Areas
An area is any well defined location that has been mapped in farmOS, such as a field, greenhouse, building, etc.

Here's an example of what an area looks like as a JavaScript object:

```js
{
  field_farm_files: [],
  field_farm_images: [],
  field_farm_geofield: [
    {
      geom: 'POLYGON ((-75.53640916943549 42.54421203378203, -75.53607389330863 42.54421796218091, -75.53607121109961 42.54415472589722, -75.53640648722647 42.54414682135726, -75.53640916943549 42.54421203378203))',
      geo_type: 'polygon',
      lat: '42.544182866769',
      lon: '-75.536241049158',
      left: '-75.536409169435',
      top: '42.544217962181',
      right: '-75.536071211100',
      bottom: '42.544146821357',
      srid: null,
      latlon: '42.544182866769,-75.536241049158',
      schemaorg_shape: '42.544146821357,-75.536409169435 42.544146821357,-75.536071211100 42.544217962181,-75.536071211100 42.544217962181,-75.536409169435 42.544146821357,-75.536409169435'
    }
  ],
  field_farm_area_type: 'greenhouse',
  tid: '22',
  name: 'F1',
  description: '',
  weight: '0',
  node_count: 0,
  url: 'http://localhost/farm/area/f1',
  vocabulary: {
    uri: 'http://localhost/taxonomy_vocabulary/2',
    id: '2',
    resource: 'taxonomy_vocabulary'
  },
  parent: [
    {
      uri: 'http://localhost/taxonomy_term/11',
      id: 11,
      resource: 'taxonomy_term'
    }
  ],
  parents_all: [
    {
      uri: 'http://localhost/taxonomy_term/22',
      id: '22',
      resource: 'taxonomy_term'
    },
    {
      uri: 'http://localhost/taxonomy_term/11',
      id: '11',
      resource: 'taxonomy_term'
    }
  ],
  feeds_item_guid: null,
  feeds_item_url: null,
  feed_nid: null
}
```

Methods for getting, sending and deleting areas are namespaced on the `farm.area` property.

#### `.get()`
Use the `.get()` method to retrieve a single area as a JavaScript object, or an array of objects, which can be filtered:
```js
// Leave the parameter undefined to fetch all available areas
farm.area.get()
  .then(res => console.log(`Area #${res[0].tid} is called ${res[0].name}`))

// Accepts a number for the tid of the area you wish to fetch
farm.area.get(123)
  .then(res => console.log(`Area #123 is called ${res.name}`))

// Pass an options object to filter the results
farm.area.get({
  page: 2, // default === null
  type: 'field', // default === ''
}).then(res => console.log(`Area #${res[0].tid} is called ${res[0].name}`))

```
__NOTE:__ Areas use a `tid` property, unlike logs and assets which have an `id`. This stands for taxonomy ID. In the future this may be changed to make it more consistent with the other entities.

The options object can have two properties: `page` is the page number in the sequence of paginated results, starting from 0 and in batches of 100 areas; `type` filters the results by area type.

The types of areas are:
- `bed`
- `building`
- `greenhouse`
- `paddock`
- `field`
- `landmark`
- `water`
- `property`

#### `.send()`
Send can be used to create a new area, or if the `tid` property is included, to update an existing area:
```js
farm.area.send(area, token)
  .then(res => console.log(`Log was assigned an tid of ${res.tid}`));
```

#### `.delete()`
__THIS METHOD HAS NOT BEEN FULLY DEVELOPED YET AND MAY NOT WORK__
```js
// For now, just an example of what it should look like eventually
farm.area.delete(123, token);
```


### Farm & User Information
For requesting information about the farm, there is just one method, `.info()`, which is a getter.
#### `.info()`
```js
farm.info()
  .then(res => console.log(`The farm's name is ${res.name}`))
```


## MAINTAINERS

Current maintainers:
 * Jamie Gaehring - https://jgaehring.com

 This project has been sponsored by:

  * [Farmier](https://farmier.com)
  * [Our Sci](http://our-sci.net)
  * [Bionutrient Food Association](https://bionutrient.org)
  * [Foundation for Food and Agriculture Research](https://foundationfar.org/)