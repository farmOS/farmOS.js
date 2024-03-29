# Remotes

## Working with remote farmOS instances
A farmOS server based on Drupal JSON:API authenticates users using [OAuth2](https://oauth.net/2/). Most details of this exchange are abstracted by the farmOS.js client, although it can be helpful to have some understanding of the OAuth protocol. For more specific details on the type of OAuth configurations that are possible with farmOS servers, see the [farmOS OAuth docs](https://docs.farmos.org/development/api/authentication/#oauth2-details).

## Configuring the host
At the very least, you will need to provide the host address of the server you are trying to reach, such as https://farm.example.com/. This host can be provided as part of the `remote` options when you create your farm instance:

```js
import farmOS from 'farmos';

const remoteConfig = {
  host: 'https://farm.example.com',
  clientId: 'farm',
  getToken: () => JSON.parse(localStorage.getItem('token')),
  setToken: token => localStorage.setItem('token', JSON.stringify(token)),
};
const options = { remote: remoteConfig };
const farm = farmOS(options);
```

The only required options are `host` and `clientId`, although both will default to the empty string (`''`). Therefore instantiation should not throw an exception if those options are not provided, but attempts to connect most likely will. Leaving the `host` as `undefined` or `''` can sometimes be useful in local development, when you wish requests to be sent to relative path. The value of `clientId` (aka, `client_id`) will vary with the implementation, but more details can be found in the [farmOS OAuth docs](https://docs.farmos.org/development/api/authentication/#clients).

In addition to those options, you can also provide functions for synchronously getting and setting the tokens in your local environment, as with `window.localStorage` above. If these options are not provided, the tokens will only be stored in memory, so will be lost when your program terminates or your farm instance is garbage collected.

It is also possible to add a remote after creating your farm instance has been created, using the `remote.add` method, which takes the same type of remote configuration object as above:

```js
farm.remote.add(remoteConfig);
```

This can be useful when you may still be awaiting user input to provide the host or other remote configuration at the time you create the farm instance.

## Authorizing a user
Once a farm instance has been created and the host has been set, you can use a [Password Grant](https://docs.farmos.org/development/api/authentication/#password-credentials-grant):

```js
const username = 'Farmer Sam';
const password = '123_you_cant_guess_me';
farm.remote.authorize(username, password);
```

#### ⚠️ __WARNING__ ⚠️
At this time, Password Grant is the only available method for authorization, but it is only recommended for trusted clients (called _1st party_), such as Field Kit.

## General information and other requests
In addition to providing methods for configuring the host and authorizing, the `farm.remote` namespace other general methods for interacting with a farmOS server.

The `request` method is a pre-configured axios client that only provides access and refresh tokens to authorized farm instances, but otherwise just accepts an endpoint (with or without URL search parameters) as its first parameter, and an optional [request config](https://axios-http.com/docs/req_config) object as the second parameter (defaults to `GET` method):

```js
const url = 'https://farm.example.com/api/asset_type/asset_type';
farm.remote.request(url, { method: 'GET' }).then((res) => { /** etc */ });
```

This can be a useful (or necessary) escape hatch for leveraging RESTful API features not covered by farmOS.js explicitly.

There is also an `info` method, which takes no parameters:

```js
farm.remote.info().then((res) => { /** etc */ });
```

For farmOS based on Drupal 9 and JSON:API, this is essentially a shorthand for requesting the `/api` endpoint.

## Subrequests
To reduce the number of roundtrip requests, the [Drupal `subrequests` module](https://www.drupal.org/project/subrequests) is included in most farmOS instances. A special syntax is employed in farmOS.js, however, which allows for more concise and intuitive descriptions of the subrequest dependency graph.

When sending entities to the remote, an additional `subrequest` query object can be included in the options parameter:

```js
const quantH = farm.quantity.create({
  type: 'quantity--standard', label: 'hhh', measure: 'volume',
});
const options = {
  subrequest: {
    units: {
      $find: {
        type: 'taxonomy_term--unit',
        name: 'US_gal',
      },
      $sort: {
        weight: 'DESC',
      },
      $limit: 1,
      $createIfNotFound: true,
    },
  },
};
farm.quantity.send(quantH, options);
```

This subrequest will try to find a unit with a `name` of `'US_gal'` and update the quantity's `units` field. It will select the first result (ie, `{ $limit: 1 }`) found in descending order based on the taxonomy term's hierarchical `weight` (ie, `{ $sort: { weight: 'DESC' } }`). If no results are found, it will create the unit with all the specified fields, then update the quantity's `units` field.

In the case that the first parameter to `.send()` is an array of entities, rather than a single entity, these operations will be applied to each entity in the array in succession. Alternatively, the `subrequest` option can be a function that takes an entity parameter, corresponding to each of the entities in the array being sent, and returns a subrequest query object:

```js
const quantities = [quantF, quantG, quantH];
const options = {
  subrequest(quant) {
    const { attributes: { measure } } = quant;
    const unitName = measure === 'volume' ? 'US_gal' : 'US_gal_acre';
    return {
      units: {
        $find: {
          type: 'taxonomy_term--unit',
          name: unitName,
        },
        $sort: {
          weight: 'DESC',
        },
        $limit: 1,
        $createIfNotFound: true,
      },
    };
  },
};
farm.quantity.send(quantities, options);
```

Refer to the [`test/subrequest.js`](https://github.com/farmOS/farmOS.js/blob/main/test/subrequest.js) for more detailed examples on its usage.
