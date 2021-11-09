# JSON Schema Tools
These are some basic utilities for handling JSON Schema documents in general, not just farmOS schemas. I'm surprised that there weren't more utilities available for actually [generating data from JSON Schema](https://json-schema.org/implementations.html#generators-from-schemas) in JavaScript. An incomplete option may have been Cloudflare's [`json-schema-tools`](https://github.com/cloudflare/json-schema-tools), but apart from not providing all the functionality I needed, and a lot I didn't, it doesn't seem to be maintained any more, and honestly I found it a bit inscrutable.

I doubt I'll ever extract these functions as their own library, but I feel it's worthwhile to keep it agnostic to the specifics of farmOS as long as I can. As such, I think it's worth keeping some simple documentation, separate from the rest of the documentation for farmOS.js, to at least describe the main features and what aspects of the JSON Schema specification it supports.

# Usage
There are three main modules for schema manipulation: `reference.js`, `properties.js` and `default.js`. All functions maintain immutability insofar as they return deep clones of the schema or its subschemas that are provided as arguments.

## References
- `getDefinition`
- `getReference`
- `dereference`

The key function here is `dereference`. It basically removes self-references, or references to supplied "known schemas", indicated by the `$ref` keyword, and returns an equivalent schema. Accordingly, the dereferenced schema may contain circular references, so it can be handy to hold onto the original schema for the purpose of serialization.

Although `dereference` is not strictly required for the functions related to properties and defaults (below), those functions will throw if they encounter a `$ref` keyword at certain points of their evaluation. It's recommended to use `dereference` prior to calling those functions, but ultimately that is the responsibility of the caller.

## Properties (schema traversal)
- `getProperties`
- `getProperty`
- `getPath`
- `listProperties`

farmOS.js is only really using `listProperties` here, as a form of rudimentary validation when handling props passed to the `create`/`update`/`merge` functions, but `getPath` is a very useful function for traversing a schema.

## Defaults
- `getDefault`

This is what ultimately is used for generating data in farmOS.js. I've aimed to keep its base functionality as unopinionated as possible. That is, if no `options` parameter is provided, and the schema or subschema being targeted does not have a `default` keyword, then `undefined` will be returned.

### Examples for the `options` parameter
I feel like these are most succinctly explained by providing examples:

```js
const options = {
  byType: {
    string: () => '',
    object: (subschema) => {
      if (subschema.type === 'object') {
        return {};
      }
      return null;
    },
  },
  byFormat: {
    'date-time': () => new Date().toISOString(),
  },
  use: [ // currently only applied for these 3 keywords
    'minimum', // eg, if the schema has { minimum: 42 }, then 42 will be the default used
    'maximum',
    'multipleOf', // eg, { multipleOf: 10 } will get a default of 10
  ],
}
```

It's worth noting there is an order of precedence to these options, which will be applied as followed:

1. If the `default` keyword is found in the schema, that will be returned.
2. If the `const` keyword is found int he schema, that will be returned.
3. If the schema has a `type` of `null`, `null` will always be returned.
4. If the `byFormat` option provides a matching format for a `string` schema, that will be evaluated and returned.
5. If the `use` option is provided, and has a length of more than 0, the schema will search for each keyword in the `use` array, starting at index 0 (more details below).
6. If the `byType` option provides a matching type for the current schema, that will be evaluated and returned.

Essentially, `getDefault` strives to apply these options in their order of specificity, so that in the example above, a schema with the `date-time` format will get a proper date default, rather than the empty string. 

When searching for matches for the `use` keyword, the first keyword to be found in the schema will be returned as the default, w/o searching for the others. So in the example above, if both the schema contained both `{ minimum: 20 }` and `{ multipleOf: 10 }`, the default returned would be `20`. Therefore, care should be given to how the array is ordered.

# Supported JSON Schema features
This is not an exhaustive list, by any means.

## Conditional keywords
- `allOf`
- `anyOf`
- `oneOf`
- `not`

## Types
- `string`
- `number`
- `integer`
- `object`
- `array`
- `boolean`
- `null`

## Boolean JSON Schemas
As described in section [4.3.2](https://json-schema.org/draft/2020-12/json-schema-core.html#rfc.section.4.3.2) of the specification, I've tried as best I can to allow for booleans `true` and `false` as valid schemas (hence the `boolOrThrow` utility). 

# Partially supported JSON Schema features

## References and pointers
- `$id`
- `$ref`
- `$def` / `definition`

I'd like to be say I can guarantee all `$ref` keywords will be supported, so long as they conform to the basic specs of a URI or JSON Pointer, but I'm a little too fuzzy on the requirements, especially for the latter, to be sure. That said, I've tried as best I could to adhere to the concept of the "base URI", as described in the JSON Schema guide on ["Structuring a complex schema"](https://json-schema.org/understanding-json-schema/structuring.html#base-uri).

## Other keywords
- `enum`
- `const`

Schemas with these keywords won't be rejected, but I don't have very special support for manipulating their values.
