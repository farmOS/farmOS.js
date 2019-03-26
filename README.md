# farmOS.js

[![Licence](https://img.shields.io/badge/Licence-GPL%203.0-blue.svg)](https://opensource.org/licenses/GPL-3.0/)
[![Last commit](https://img.shields.io/github/last-commit/farmOS/farmOS.js.svg?style=flat)](https://github.com/farmOS/farmOS-client/commits)
[![Twitter](https://img.shields.io/twitter/follow/farmOSorg.svg?label=%40farmOSorg&style=flat)](https://twitter.com/farmOSorg)
[![Chat](https://img.shields.io/matrix/farmOS:matrix.org.svg)](https://riot.im/app/#/room/#farmOS:matrix.org)
[![npm](https://img.shields.io/npm/v/farmos.svg)](https://www.npmjs.com/package/farmos)

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
  - [Taxonomy Terms](#taxonomy-terms)
    - [`.get()`](#get-3)
    - [`.send()`](#send-3)
    - [`.delete()`](#delete-3)
  - [Vocabulary](#vocabulary)
  - [Farm & User Information](#farm--user-information)
    - [`.info()`](#info)

## Installation
To install using npm (the Node Package Manager):

```bash
$ npm install farmos
```

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

A log is any type of event that occurs on the farm, from a planting to a harvest
to just a general observation.

Here is an example of what one would look like as a JS object:

```js
const log = {
  id: '1',
  name: 'some log name',
  type: 'farm_observation',
  timestamp: '1519423702',
  done: '1',
  notes: {
    value: '<p>some notes</p>\n',
    format: 'farm_format'
  },
}
```

Methods for getting, sending and deleting logs are namespaced on the `farm.log`
property.

#### `.get()`

Use the `.get()` method to retrieve a single log as a JavaScript object, or an
array of objects, which can be filtered:

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

The options object can have two properties: `page` is the page number in the
sequence of paginated results, starting from 0 and in batches of 100 logs;
`type` filters the results by log type.

The four default log types are:

- `farm_activity`
- `farm_harvest`
- `farm_input`
- `farm_observation`

Other log types may be provided by add-on modules in farmOS.

#### `.send()`

Send can be used to create a new log, or if the `id` property is included, to
update an existing log:

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

Assets are any piece of property or durable good that belongs to the farm, such
as a piece of equipment, a specific crop, or an animal.

Here is an example of what one would look like as a JavaScript object:

```js
{
  id: '1',
  name: 'Brunhilde',
  type: 'animal',
  animal_type: {
    id: '12',
    resource: 'taxonomy_term'
  },
  description: {
    value: '<p>some notes</p>\n',
    format: 'farm_format'
  },
  archived: '0',
}
```

Methods for getting, sending and deleting assets are namespaced on the
`farm.asset` property.

#### `.get()`

Use the `.get()` method to retrieve a single asset as a JavaScript object, or an
array of asset objects, which can be filtered:

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

The options object can have two properties: `page` is the page number in the
sequence of paginated results, starting from 0 and in batches of 100 assets;
`archived` is a boolean which determines whether to retrieve assets which the
user has chosen to archive; `type` filters the results by asset type.

Some common asset types include:

- `animal`
- `equipment`
- `planting`

Other asset types may be provided by add-on modules in farmOS.

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
  tid: '22',
  name: 'F1',
  description: '',
  area_type: 'greenhouse',
  geofield: [
    {
      geom: 'POLYGON ((-75.53640916943549 42.54421203378203, -75.53607389330863 42.54421796218091, -75.53607121109961 42.54415472589722, -75.53640648722647 42.54414682135726, -75.53640916943549 42.54421203378203))',
    }
  ],
  vocabulary: {
    id: '2',
    resource: 'taxonomy_vocabulary'
  },
  parent: [
    {
      id: 11,
      resource: 'taxonomy_term'
    }
  ],
  weight: '0',
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

Some common area types include:

- `field`
- `building`
- `property`
- `water`
- `other`

Other area types may be provided by add-on modules in farmOS.

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

### Taxonomy Terms
farmOS allows farmers to build vocabularies of terms for various categorization
purposes. These are referred to as "taxonomies" in farmOS (and Drupal), although
"vocabulary" is sometimes used interchangeably.

Some things that are represented as taxonomy terms include quantity units,
crops/varieties, animal species/breeds, input materials, and log categories.
See "Endpoints" above for specific API endpoints URLs.

A very basic taxonomy term JSON structure looks like this:

```json
{
  "tid": "3",
  "name": "Cabbage",
  "description": "",
  "vocabulary": {
    "id": "7",
    "resource": "taxonomy_vocabulary",
  },
  "parent": [
    {
      "id": "10",
      "resource": "taxonomy_term",
    },
  ],
  "weight": "5",
}
```

The `tid` is the unique ID of the term (database primary key). When creating a
new term, the only required fields are `name` and `vocabulary`. The vocabulary
is an ID that corresponds to the specific vocabulary the term will be a part of
(eg: quantity units, crops/varieties, log categories, etc). The fields `parent`
and `weight` control term hierarchy and ordering (a heavier `weight` will sort
it lower in the list).

#### `.get()`
Use the `.get()` method to retrieve a single vocabulary as a JavaScript object by passing in that vocabulary's machine name, or an array of objects, which can be filtered:

```js
farm.term.get()
  .then(res => console.log(`Term #${res.list[0].tid} is called ${res.list[0].name}`))

farm.term.get('farm_crops')
  .then(res => console.log(`${res.list[0].name} is a crop.`))

farm.term.get({
  vocabulary: 'farm_crops',
  name: 'Icicle Radish',
  page: 0,
}).then(res => console.log(`It is ${(res.list.length > 0)} that 'Icicle Radish' is the name of a crop.`))
```


#### `.send()`

Send can be used to create a new taxonomy term, or if the `tid` property is included in the term object, to update an existing area:

```js
farm.area.send(term, token)
  .then(res => console.log(`Log was assigned an tid of ${res.tid}`));
```

#### `.delete()`

__THIS METHOD HAS NOT BEEN DEVELOPED YET__


### Vocabulary

Every taxonomy term is a member of a particular "vocabulary", so for instance, `"Carrots"` might be a taxonomy term, which is a part of the `farm_crops` vocabulary, while `"Greenhouse #5"` might be term in the `farm_areas` vocabulary. The vocabulary id, `vid`, will be a required field when creating a new term or updating an existing one, so in most cases it will be necessary to lookup the `vid` for the particular vocabulary to which it belongs before sending.

Here are the machine names of the more common vocabularies which are used in farmOS:
- `farm_animal_types`
- `farm_areas`
- `farm_crops`
- `farm_crop_families`
- `farm_log_categories`
- `farm_materials`
- `farm_quantity_units`
- `farm_season`
- `farm_soil_names`

Note that the `vid` for each vocabulary may vary between different farmOS servers, so even if you're storing the `vid` in your application for one farmOS instance, you'll need to repeat the lookup process for any other instance to guarantee you have the proper `vid`.

The only method available is a getter for basic lookup:

```js
// Get all vocabularies back in a list, by passing no argument
farm.vocabulary();

// Get a specific vocabulary by passing its machine name
farm.vocabulary('farm_crops');
```

It is not possible to create or modify a vocabulary via the API.


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

