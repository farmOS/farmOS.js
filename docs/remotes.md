# Remotes

## Working with remote farmOS instances
A farmOS server based on Drupal JSON:API authenticates users using [OAuth2](https://oauth.net/2/). Most details of this exchange are abstracted by the farmOS.js client, although it can be helpful to have some understanding of the OAuth protocol. For more specific details on the type of OAuth configurations that are possible with farmOS servers, see the [farmOS OAuth docs](https://docs.farmos.org/development/api/authentication/#oauth2-details).

## Configuring the host
At the very least, you will need to provide the host address of the server you are trying to reach, such as https://farm.example.com/. This host can be provided as part of the `remote` options when you create your farm instance:

```js
import farmOS from 'farmos';

const remote = {
  host: 'https://farm.example.com',
  clientId: 'farm_client',
  getToken: () => JSON.parse(localStorage.getItem('token')),
  setToken: token => localStorage.setItem('token', JSON.stringify(token)),
};
const farm = farmOS({ remote });
```

Although the `host` is the only required option, in the strictest sense, you will most likely need to provide a `clientId` as well. Details of this `clientId` (aka, `client_id`) will vary with the implementation, but more details can be found in the [farmOS OAuth docs](https://docs.farmos.org/development/api/authentication/#clients).

In addition, you can provide optional functions for synchronously getting and setting the tokens in your local environment, as with `window.localStorage` above. If these options are not provided, the tokens will only be stored in memory, so will be lost when your program terminates or your farm instance is garbage collected.

It is also possible to set the `host` after creating your farm instance has been created, using the `setHost` method on the `remote` namespace:

```js
farm.remote.setHost('https://farm.example.com');
```

This can be useful when you may still be awaiting user input to provide the host at the time you create the farm instance.

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
