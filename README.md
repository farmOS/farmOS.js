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
#### `.get()`
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
```js
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
