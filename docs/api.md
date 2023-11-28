# API Reference

## Typedefs

<dl>
<dt><a href="#FarmEntityMethods">FarmEntityMethods</a> : <code>Object</code></dt>
<dd><p>The methods for writing to local copies of farmOS data structures, such as
assets, logs, etc, and for transmitting those entities to a farmOS server.</p>
</dd>
<dt><a href="#FarmObject">FarmObject</a> : <code>Object</code></dt>
<dd><p>A collection of functions for working with farmOS data structures, their
associated metadata and schemata, and for interacting with farmOS servers.</p>
</dd>
<dt><a href="#EntityConfig">EntityConfig</a> : <code><a href="#EntityConfig">EntityConfig</a></code></dt>
<dd><p>To enable support for each entity type, its config object must be provided.</p>
</dd>
<dt><a href="#farmOS">farmOS</a> ⇒ <code><a href="#FarmObject">FarmObject</a></code></dt>
<dd><p>The main farmOS factory function for creating a new farm object.</p>
</dd>
<dt><a href="#JsonSchema">JsonSchema</a> : <code><a href="#JsonSchema">JsonSchema</a></code></dt>
<dd><p>JSON Schema for defining the entities supported by a farmOS instance.</p>
</dd>
<dt><a href="#JsonSchemaDereferenced">JsonSchemaDereferenced</a> : <code><a href="#JsonSchemaDereferenced">JsonSchemaDereferenced</a></code></dt>
<dd><p>JSON Schema Dereferenced: A JSON Schema, but w/o any $ref keywords. As such,
it may contain circular references that cannot be serialized.</p>
</dd>
<dt><a href="#BundleSchemata">BundleSchemata</a> : <code>Object.&lt;string, JsonSchema&gt;</code></dt>
<dd><p>An object containing the schemata for the bundles of a farmOS entity, with
the bundle name as key and its corresponding schema as its value.</p>
</dd>
<dt><a href="#EntitySchemata">EntitySchemata</a> : <code>Object.&lt;string, BundleSchemata&gt;</code></dt>
<dd><p>An object containing the schemata for the bundles of a farmOS entity, with
the bundle name as key and its corresponding schema as its value.</p>
</dd>
<dt><a href="#ModelEntityMethods">ModelEntityMethods</a> : <code>Object</code></dt>
<dd><p>The methods for writing to local copies of farmOS data structures, such as
assets, logs, etc.</p>
</dd>
<dt><a href="#FarmModel">FarmModel</a> : <code>Object</code></dt>
<dd><p>A collection of functions for working with farmOS data structures, their
associated metadata and schemata.</p>
</dd>
<dt><a href="#EntityConfig">EntityConfig</a> : <code><a href="#EntityConfig">EntityConfig</a></code></dt>
<dd></dd>
<dt><a href="#model">model</a> ⇒ <code><a href="#FarmModel">FarmModel</a></code></dt>
<dd><p>Create a farm model for generating and manipulating farmOS data structures.</p>
</dd>
<dt><a href="#ClientEntityMethods">ClientEntityMethods</a> : <code>Object</code></dt>
<dd><p>The methods for transmitting farmOS data structures, such as assets, logs,
etc, to a farmOS server.</p>
</dd>
<dt><a href="#FetchSchema">FetchSchema</a> ⇒ <code>Promise.&lt;(EntitySchemata|BundleSchemata|JsonSchema)&gt;</code></dt>
<dd><p>Fetch JSON Schema documents for farmOS data structures.</p>
</dd>
<dt><a href="#AuthMixin">AuthMixin</a> ⇒ <code>Object.&lt;string, function()&gt;</code></dt>
<dd></dd>
<dt><a href="#FarmClient">FarmClient</a> : <code>Object</code></dt>
<dd><p>A collection of functions for transmitting farmOS data structures to and
from a farmOS Drupal 9 server using JSON:API.</p>
</dd>
<dt><a href="#EntityConfig">EntityConfig</a> : <code><a href="#EntityConfig">EntityConfig</a></code></dt>
<dd></dd>
<dt><a href="#client">client</a> ⇒ <code><a href="#FarmClient">FarmClient</a></code></dt>
<dd><p>Create a farm client for interacting with farmOS servers.</p>
</dd>
<dt><a href="#EntityReference">EntityReference</a> : <code>Object</code></dt>
<dd></dd>
<dt><a href="#Entity">Entity</a> : <code>Object</code></dt>
<dd></dd>
<dt><a href="#EntityConfig">EntityConfig</a> : <code>Object</code></dt>
<dd></dd>
<dt><a href="#DefaultEntities">DefaultEntities</a> : <code>Object.&lt;String, EntityConfig&gt;</code></dt>
<dd></dd>
</dl>

<a name="FarmEntityMethods"></a>

## FarmEntityMethods : <code>Object</code>
The methods for writing to local copies of farmOS data structures, such as
assets, logs, etc, and for transmitting those entities to a farmOS server.

**Kind**: global typedef  
**Properties**

| Name | Type |
| --- | --- |
| create | <code>createEntity</code> | 
| update | <code>updateEntity</code> | 
| merge | <code>mergeEntity</code> | 
| [fetch] | <code>fetchEntity</code> | 
| [send] | <code>sendEntity</code> | 
| [delete] | <code>deleteEntity</code> | 

<a name="FarmObject"></a>

## FarmObject : <code>Object</code>
A collection of functions for working with farmOS data structures, their
associated metadata and schemata, and for interacting with farmOS servers.

**Kind**: global typedef  
**Properties**

| Name | Type |
| --- | --- |
| schema | <code>Object</code> | 
| schema.get | <code>function</code> | 
| schema.set | <code>function</code> | 
| schema.on | <code>function</code> | 
| [schema.fetch] | <code>function</code> | 
| meta | <code>Object</code> | 
| meta.isUnsynced | <code>function</code> | 
| remote | <code>Object</code> | 
| remote.request | <code>module:axios~AxiosInstance</code> | 
| [remote.info] | <code>function</code> | 
| [remote.authorize] | <code>function</code> | 
| [remote.getToken] | <code>function</code> | 
| asset | [<code>FarmEntityMethods</code>](#FarmEntityMethods) | 
| file | [<code>FarmEntityMethods</code>](#FarmEntityMethods) | 
| log | [<code>FarmEntityMethods</code>](#FarmEntityMethods) | 
| plan | [<code>FarmEntityMethods</code>](#FarmEntityMethods) | 
| quantity | [<code>FarmEntityMethods</code>](#FarmEntityMethods) | 
| term | [<code>FarmEntityMethods</code>](#FarmEntityMethods) | 
| user | [<code>FarmEntityMethods</code>](#FarmEntityMethods) | 

<a name="EntityConfig"></a>

## EntityConfig : [<code>EntityConfig</code>](#EntityConfig)
To enable support for each entity type, its config object must be provided.

**Kind**: global typedef  
<a name="farmOS"></a>

## farmOS ⇒ [<code>FarmObject</code>](#FarmObject)
The main farmOS factory function for creating a new farm object.

**Kind**: global typedef  

| Param | Type |
| --- | --- |
| farmConfig | <code>Object</code> | 

**Properties**

| Name | Type | Default |
| --- | --- | --- |
| [config.schemata] | [<code>EntitySchemata</code>](#EntitySchemata) |  | 
| [config.remote] | <code>Object</code> |  | 
| [config.remote.adapter] | [<code>client</code>](#client) | <code>d9JsonApiAdapter</code> | 
| [config.entities] | <code>Object.&lt;String, EntityConfig&gt;</code> | <code>defaultEntities</code> | 

<a name="JsonSchema"></a>

## JsonSchema : [<code>JsonSchema</code>](#JsonSchema)
JSON Schema for defining the entities supported by a farmOS instance.

**Kind**: global typedef  
**See**: [https://json-schema.org/understanding-json-schema/index.html](https://json-schema.org/understanding-json-schema/index.html)  
<a name="JsonSchemaDereferenced"></a>

## JsonSchemaDereferenced : [<code>JsonSchemaDereferenced</code>](#JsonSchemaDereferenced)
JSON Schema Dereferenced: A JSON Schema, but w/o any $ref keywords. As such,
it may contain circular references that cannot be serialized.

**Kind**: global typedef  
<a name="BundleSchemata"></a>

## BundleSchemata : <code>Object.&lt;string, JsonSchema&gt;</code>
An object containing the schemata for the bundles of a farmOS entity, with
the bundle name as key and its corresponding schema as its value.

**Kind**: global typedef  
<a name="EntitySchemata"></a>

## EntitySchemata : <code>Object.&lt;string, BundleSchemata&gt;</code>
An object containing the schemata for the bundles of a farmOS entity, with
the bundle name as key and its corresponding schema as its value.

**Kind**: global typedef  
<a name="ModelEntityMethods"></a>

## ModelEntityMethods : <code>Object</code>
The methods for writing to local copies of farmOS data structures, such as
assets, logs, etc.

**Kind**: global typedef  
**Properties**

| Name | Type |
| --- | --- |
| create | <code>createEntity</code> | 
| update | <code>updateEntity</code> | 
| merge | <code>mergeEntity</code> | 

<a name="FarmModel"></a>

## FarmModel : <code>Object</code>
A collection of functions for working with farmOS data structures, their
associated metadata and schemata.

**Kind**: global typedef  
**Properties**

| Name | Type |
| --- | --- |
| schema | <code>Object</code> | 
| schema.get | <code>function</code> | 
| schema.set | <code>function</code> | 
| schema.on | <code>function</code> | 
| meta | <code>Object</code> | 
| meta.isUnsynced | <code>function</code> | 
| asset | [<code>ModelEntityMethods</code>](#ModelEntityMethods) | 
| file | [<code>ModelEntityMethods</code>](#ModelEntityMethods) | 
| log | [<code>ModelEntityMethods</code>](#ModelEntityMethods) | 
| plan | [<code>ModelEntityMethods</code>](#ModelEntityMethods) | 
| quantity | [<code>ModelEntityMethods</code>](#ModelEntityMethods) | 
| term | [<code>ModelEntityMethods</code>](#ModelEntityMethods) | 
| user | [<code>ModelEntityMethods</code>](#ModelEntityMethods) | 

<a name="EntityConfig"></a>

## EntityConfig : [<code>EntityConfig</code>](#EntityConfig)
**Kind**: global typedef  
<a name="model"></a>

## model ⇒ [<code>FarmModel</code>](#FarmModel)
Create a farm model for generating and manipulating farmOS data structures.

**Kind**: global typedef  

| Param | Type |
| --- | --- |
| options | <code>Object</code> | 

**Properties**

| Name | Type | Default |
| --- | --- | --- |
| [options.schemata] | [<code>EntitySchemata</code>](#EntitySchemata) |  | 
| [options.entities] | <code>Object.&lt;String, EntityConfig&gt;</code> | <code>defaultEntities</code> | 


* [model](#model) ⇒ [<code>FarmModel</code>](#FarmModel)
    * [~getSchemata(...args)](#model..getSchemata) ⇒ [<code>EntitySchemata</code>](#EntitySchemata) \| [<code>BundleSchemata</code>](#BundleSchemata) \| [<code>JsonSchemaDereferenced</code>](#JsonSchemaDereferenced)
    * [~setSchemata(...args)](#model..setSchemata)

<a name="model..getSchemata"></a>

### model~getSchemata(...args) ⇒ [<code>EntitySchemata</code>](#EntitySchemata) \| [<code>BundleSchemata</code>](#BundleSchemata) \| [<code>JsonSchemaDereferenced</code>](#JsonSchemaDereferenced)
Retrieve all schemata that have been previously set, or the schemata of a
particular entity, or one bundle's schema, if specified.

**Kind**: inner method of [<code>model</code>](#model)  

| Param | Type |
| --- | --- |
| ...args | <code>String</code> | 

<a name="model..setSchemata"></a>

### model~setSchemata(...args)
Load all schemata, the schemata of a particular entity, or one bundle's
schema, if specified.

**Kind**: inner method of [<code>model</code>](#model)  
**Void**:   

| Param | Type |
| --- | --- |
| ...args | <code>String</code> \| [<code>EntitySchemata</code>](#EntitySchemata) \| [<code>BundleSchemata</code>](#BundleSchemata) \| [<code>JsonSchema</code>](#JsonSchema) | 

<a name="ClientEntityMethods"></a>

## ClientEntityMethods : <code>Object</code>
The methods for transmitting farmOS data structures, such as assets, logs,
etc, to a farmOS server.

**Kind**: global typedef  
**Properties**

| Name | Type |
| --- | --- |
| fetch | <code>fetchEntity</code> | 
| send | <code>sendEntity</code> | 
| delete | <code>deleteEntity</code> | 

<a name="FetchSchema"></a>

## FetchSchema ⇒ <code>Promise.&lt;(EntitySchemata\|BundleSchemata\|JsonSchema)&gt;</code>
Fetch JSON Schema documents for farmOS data structures.

**Kind**: global typedef  

| Param | Type | Description |
| --- | --- | --- |
| [entity] | <code>string</code> | The farmOS entity for which you wish to retrieve schemata. |
| [bundle] | <code>string</code> | The entity bundle for which you wish to retrieve schemata. |

<a name="AuthMixin"></a>

## AuthMixin ⇒ <code>Object.&lt;string, function()&gt;</code>
**Kind**: global typedef  

| Param | Type |
| --- | --- |
| request | <code>module:axios~AxiosInstance</code> | 
| authOptions | <code>Object</code> | 

**Properties**

| Name | Type |
| --- | --- |
| authOptions.host | <code>String</code> | 

<a name="FarmClient"></a>

## FarmClient : <code>Object</code>
A collection of functions for transmitting farmOS data structures to and
from a farmOS Drupal 9 server using JSON:API.

**Kind**: global typedef  
**Properties**

| Name | Type |
| --- | --- |
| request | <code>module:axios~AxiosInstance</code> | 
| [authorize] | <code>function</code> | 
| [getToken] | <code>function</code> | 
| info | <code>function</code> | 
| schema | <code>Object</code> | 
| schema.fetch | [<code>FetchSchema</code>](#FetchSchema) | 
| asset | [<code>ClientEntityMethods</code>](#ClientEntityMethods) | 
| file | [<code>ClientEntityMethods</code>](#ClientEntityMethods) | 
| log | [<code>ClientEntityMethods</code>](#ClientEntityMethods) | 
| plan | [<code>ClientEntityMethods</code>](#ClientEntityMethods) | 
| quantity | [<code>ClientEntityMethods</code>](#ClientEntityMethods) | 
| term | [<code>ClientEntityMethods</code>](#ClientEntityMethods) | 
| user | [<code>ClientEntityMethods</code>](#ClientEntityMethods) | 

<a name="EntityConfig"></a>

## EntityConfig : [<code>EntityConfig</code>](#EntityConfig)
**Kind**: global typedef  
<a name="client"></a>

## client ⇒ [<code>FarmClient</code>](#FarmClient)
Create a farm client for interacting with farmOS servers.

**Kind**: global typedef  

| Param | Type |
| --- | --- |
| host | <code>String</code> | 
| [options] | <code>Object</code> | 

**Properties**

| Name | Type | Default |
| --- | --- | --- |
| [options.auth] | [<code>AuthMixin</code>](#AuthMixin) | <code>oauth</code> | 
| [options.entities] | <code>Object.&lt;String, EntityConfig&gt;</code> | <code>defaultEntities</code> | 
| [options.clientId] | <code>String</code> |  | 
| [options.getToken] | <code>function</code> |  | 
| [options.setToken] | <code>function</code> |  | 

<a name="EntityReference"></a>

## EntityReference : <code>Object</code>
**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| id | <code>String</code> | A v4 UUID as specified by RFC 4122. |
| type | <code>String</code> | Corresponding to the entity bundle (eg, 'activity'). |

<a name="Entity"></a>

## Entity : <code>Object</code>
**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| id | <code>String</code> | A v4 UUID as specified by RFC 4122. |
| type | <code>String</code> | The combined form of entity & bundle (eg, 'log--activity'). |
| attributes | <code>Object</code> | Values directly attributable to this entity. |
| relationships | <code>Object.&lt;String, (EntityReference\|Array.&lt;EntityReference&gt;)&gt;</code> | References to other entities that define a one-to-one or one-to-many relationship. |
| meta | <code>Object</code> | Non-domain information associated with the creation, modification, storage and transmission of the entity. |
| meta.created | <code>String</code> | An ISO 8601 date-time string indicating when the entity was first created, either locally or remotely. |
| meta.changed | <code>String</code> | An ISO 8601 date-time string indicating when the entity was last changed, either locally or remotely. |
| meta.remote | <code>Object</code> |  |
| meta.fieldChanges | <code>Object</code> |  |
| meta.conflicts | <code>Array</code> |  |

<a name="EntityConfig"></a>

## EntityConfig : <code>Object</code>
**Kind**: global typedef  
**Properties**

| Name | Type |
| --- | --- |
| nomenclature | <code>Object</code> | 
| nomenclature.name | <code>Object</code> | 
| nomenclature.shortName | <code>Object</code> | 
| nomenclature.plural | <code>Object</code> | 
| nomenclature.shortPlural | <code>Object</code> | 
| nomenclature.display | <code>Object</code> | 
| nomenclature.displayPlural | <code>Object</code> | 
| defaultOptions | <code>Object</code> | 
| defaultOptions.byType | <code>Object</code> | 
| defaultOptions.byFormat | <code>Object</code> | 

<a name="DefaultEntities"></a>

## DefaultEntities : <code>Object.&lt;String, EntityConfig&gt;</code>
**Kind**: global typedef  
**Properties**

| Name | Type |
| --- | --- |
| asset | [<code>EntityConfig</code>](#EntityConfig) | 
| file | [<code>EntityConfig</code>](#EntityConfig) | 
| log | [<code>EntityConfig</code>](#EntityConfig) | 
| plan | [<code>EntityConfig</code>](#EntityConfig) | 
| quantity | [<code>EntityConfig</code>](#EntityConfig) | 
| taxonomy_term | [<code>EntityConfig</code>](#EntityConfig) | 
| user | [<code>EntityConfig</code>](#EntityConfig) | 

