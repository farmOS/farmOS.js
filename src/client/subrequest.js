import any from 'ramda/src/any';
import chain from 'ramda/src/chain';
import compose from 'ramda/src/compose';
import evolve from 'ramda/src/evolve';
import map from 'ramda/src/map';
import mapObjIndexed from 'ramda/src/mapObjIndexed';
import match from 'ramda/src/match';
import mergeRight from 'ramda/src/mergeRight';
import partition from 'ramda/src/partition';
import path from 'ramda/src/path';
import pick from 'ramda/src/pick';
import pickBy from 'ramda/src/pickBy';
import prop from 'ramda/src/prop';
import sort from 'ramda/src/sort';
import startsWith from 'ramda/src/startsWith';
import uniqBy from 'ramda/src/uniqBy';
import { parseTypeFromFields } from '../utils';
import { generateFieldTransforms, transformLocalEntity } from './adapter/transformations';
import { parseFetchParams } from './fetch';

// Constants for sending requests via Drupal's JSON:API module.
const BASE_URI = '/api';
const SUB_URL = '/subrequests?_format=json';
const headers = {
  Accept: 'application/vnd.api+json',
  'Content-Type': 'application/vnd.api+json',
};

// Fields that contain a subrequest are separated as dependent fields, distinct
// from constant fields, whose values are known immediately.
const isKeyword = startsWith('$');
const isSubrequest = o => any(isKeyword, Object.keys(o));
const splitFields = partition(isSubrequest);

// For use with filters, to keep only their constant fields and drop any
// operators such as `'$lt'`, `'$or'`, etc.
const dropKeywords = pickBy((v, k) => !isKeyword(k));

// Subrequests that contain a JSONPath wildcard may have multiple subresponses,
// which are each given Content-Ids comprised of the original requestId appended
// w/ an additional fragment, which is itself comprised of the blueprint key
// where the wildcard was found plus an index. For instance, if a subrequest is
// given a uri of '/api/log/input/{{find-logs.body@$.data[*].id}}' and has a
// requestId of 'update-input', the first two subresponse that corresponds to it
// will have Content-Ids of 'update-input#uri{0}' and 'update-input#uri{1}',
// respectively. Therefore, each Content-Id is parsed so the subresponse can be
// more easily matched with its corresponding subrequest.
const contentIdRE = /([^#\s]+)(#(body|uri)\{(\d)\})?$/;
function parseContentId(string) {
  const [
    contentId, requestId, fragment, key, index,
  ] = match(contentIdRE, string);
  return {
    contentId, requestId, fragment, key, index,
  };
}

// Merge incoming subresponses w/ their original request data & prior subresponses.
const concatSubresponses = (prior, requests) => compose(
  // Merge right with prior, so the newest results replace any stale data.
  mergeRight(prior),
  // Map over subresponses, parsing & merging each with its request object.
  mapObjIndexed(compose(
    // Parse the body of each subresponse.
    evolve({ body: JSON.parse }),
    // Merge the request data with the response data.
    sub => mergeRight(requests[sub.requestId], sub),
    // Parse the contentId to get the original requestId, key and index, then
    // merge those properties with the rest of the subresponse.
    (sub, contentId) => mergeRight(parseContentId(contentId), sub),
  )),
  // The data object on the main response object contains the subresponses,
  // each keyed to their contentId.
  prop('data'),
);

// Determine if a relationship for a given schema is one-to-one (ie, 'object')
// or one-to-many (ie, 'array').
const typeOfRelationship = (schema, field) => path([
  'properties', 'relationships', 'properties', field, 'type',
], schema);

// Wrapper merely provides an instance of FarmObject via dependency injection.
export default function useSubrequests(farm) {
  // Called before any requests have been sent, unlike resolveDependencies. This
  // is mutually recursive with parseSubrequests, and is how each subrequest and
  // its child subrequests are assigned their priority number, which accordingly
  // determines the batch of subrequests in which it will be sent to the server.
  function parseDependentFields(fields, command, prefix) {
    const [dependentFields, constants] = splitFields(fields);
    const { bundle, entity, type } = parseTypeFromFields(constants);
    const requestId = `${prefix}/${command}:${type}`;
    const dependencies = {}; let priority = 0; const subrequests = {};
    Object.entries(dependentFields).forEach(([field, sub]) => {
      const nextPrefix = `${requestId}.${field}`;
      dependencies[field] = [];
      const requests = parseSubrequest(sub, {}, nextPrefix);
      Object.entries(requests).forEach(([reqId, req]) => {
        dependencies[field].push(reqId);
        if (req.priority > priority) priority = req.priority;
        subrequests[reqId] = req;
      });
    });
    return {
      bundle, constants, dependencies, entity, priority, requestId, subrequests, type,
    };
  }

  // This is called by blueprint functions just before the subrequest is batched
  // and actually sent to the server. This way, dependencies from earlier batches
  // of requests can be resolved to static values, and concurrent dependencies
  // (ie, dependencies that will be part of the same batch) can be suitably
  // formatted according to the JSONPath spec.
  function resolveDependencies(fieldData, ready, prior) {
    const {
      bundle, dependencies, entity, requestId,
    } = fieldData;
    const schema = farm.schema.get(entity, bundle);

    // Resolved fields include data from prior request batches, as well as concurrent
    // requests that do not require a post hoc subrequest.
    const resolved = {};
    // The names of unresolved fields will be collected, but are ultimately left
    // to the blueprint functions to handle independently.
    const unresolved = [];
    // Post hoc subrequests are concurrent blueprints for creating relationships
    // that must be added to the entity separately from the main 'create'
    // subrequest, using the entity's relationship endpoint. This is likely b/c
    // the dependency uses a JSONPath wildcard, which can't be resolved to a
    // resource identifier w/o a separate subrequest.
    const posthoc = [];
    // Only concurrent reqIds are added to waitFor, which is why it is done here
    // and is not the sole responsibility of the commands.
    const waitFor = [];

    // Match a requestId with its corresponding prior responses, if any exist.
    // The contentId is included in each response object, so just use the values.
    const matchWithResponses = reqId => Object.values(prior)
      .filter(sub => reqId === sub.requestId);
    // Field dependencies, as an array of raw requestIds, are mapped to an array
    // of corresponding resource identifiers from prior responses.
    const mapDependenciesToResources = compose(
      // Take only the first occurrence of the resource, which will be from the
      // most recent request since they've already been sorted by priority.
      uniqBy(prop('id')),
      // Strip it down to the resource identifier alone.
      map(pick(['id', 'type'])),
      // Flatten the array of nested data objects/arrays.
      chain(prop('data')),
      // Responses are sorted by highest priority, which corresponds to the most recent.
      // In the future it may also be useful to parse the requestId as a tie-breaker.
      sort((a, b) => a.priority - b.priority),
      // The array of requestIds, are each flatmapped to an array of matching responses.
      chain(matchWithResponses),
    );

    // Iterate over all dependencies, resolving their corresponding fields using
    // the most up-to-date (highest priority) data available.
    Object.entries(dependencies).forEach(([field, fieldDeps]) => {
      // Based on JSON Schema types, a field has a relation type of 'object' for
      // ONE-TO-ONE relationships, or 'array' for ONE-TO-MANY relationships.
      const relation = typeOfRelationship(schema, field);
      const concurrentIds = Object.keys(ready).filter(id => fieldDeps.includes(id));
      const resources = mapDependenciesToResources(fieldDeps);
      // ONE-TO-ONE RELATIONSHIPS
      if (relation === 'object') {
        // Concurrent dependencies are taken first b/c they will be the most recent.
        if (concurrentIds.length > 0) {
          // Taking the first result, whether there's one or many and w/o
          // sorting by priority b/c they will all be the same priority.
          const [reqId] = concurrentIds;
          // These are the only request ids that this request needs to wait for;
          // all others can be resolved or, in the case of one-to-many relationships,
          // they will be added independently as post hoc requests.
          waitFor.push(reqId);
          const resource = {
            id: `{{${reqId}.body@$.id}}`,
            type: path([reqId, 'type'], ready),
          };
          resolved[field] = resource;
        } else if (resources.length > 0) {
          const [resource] = resources;
          resolved[field] = resource;
        } else {
          unresolved.push(field);
        }
      // ONE-TO-MANY RELATIONSHIPS
      } else if (relation === 'array') {
        // Concurrent dependencies will be updated in a separate subrequest sent
        // to the parent entity's relationships enpoint; that subrequest will be
        // in the same batch, but subsequent to the original subrequest; hence,
        // they are separated as "posthoc" (ie, "after the fact") dependencies.
        concurrentIds.forEach((reqId) => {
          const uuid = `{{${requestId}.body@$.data.id}}`;
          const blueprint = {
            requestId: `${requestId}.${field}`,
            // Note the entity's relationship endpoint is used here.
            uri: `${BASE_URI}/${entity}/${bundle}/${uuid}/relationships/${field}`,
            waitFor: [requestId],
            action: 'create',
            headers,
            body: JSON.stringify({
              data: [{
                id: `{{${reqId}.body@$.data[*].id}}`,
                type: path([reqId, 'type'], ready),
              }],
            }),
          };
          posthoc.push(blueprint);
        });
        // Only dependencies from prior request batches can be fully resolved.
        resolved[field] = resources;
      } else {
        console.warn(`Uknown field in subrequest for ${bundle} ${entity}: ${field}`);
      }
    });

    return {
      resolved, posthoc, unresolved, waitFor,
    };
  }

  // Convert an entity or array of entities into Drupal format, then stringify.
  function fmtLocalData(raw) {
    const transforms = generateFieldTransforms(farm.schema.get());
    const data = Array.isArray(raw)
      ? raw.map(d => transformLocalEntity(d, transforms))
      : transformLocalEntity(raw, transforms);
    return JSON.stringify({ data });
  }

  const commands = {
    $create(fields, prefix) {
      const fieldData = parseDependentFields(fields, '$create', prefix);
      const {
        bundle, constants, entity, priority, subrequests, requestId, type,
      } = fieldData;
      const blueprint = (ready, prior) => {
        const {
          resolved, posthoc, unresolved, waitFor,
        } = resolveDependencies(fieldData, ready, prior);
        unresolved.forEach((field) => {
          const msg = `Unable to resolve ${field} field while creating `
            + `${bundle} ${entity}. Request ID: ${requestId}`;
          console.warn(msg);
        });
        const props = { ...resolved, ...constants };
        const action = 'create';
        const data = farm[entity].create(props);
        const body = fmtLocalData(data);
        const uri = `${BASE_URI}/${entity}/${bundle}`;
        const current = {
          action, body, headers, requestId, uri, waitFor,
        };
        return [current, ...posthoc];
      };
      return {
        ...subrequests,
        [requestId]: {
          blueprint, bundle, entity, priority, type,
        },
      };
    },
    $find(filter, prefix, opts) {
      const { $createIfNotFound, $limit, $sort } = opts;
      const { entity, bundle, type } = parseTypeFromFields(filter);

      // The initial fetch request with filter & other search parameters.
      const requestId = `${prefix}/$find:${type}`;
      // Nested subrequests are disallowed in $find commands, meaning they have
      // no dependencies, and so should always be included in the first batch of
      // subrequests; hence, they will always have a priority of 0.
      const priority = 0;
      const params = parseFetchParams({
        filter,
        filterTransforms: generateFieldTransforms(farm.schema.get()),
        limit: $limit,
        sort: $sort,
      });
      const blueprint = () => [{
        action: 'view',
        headers,
        requestId,
        uri: `${BASE_URI}/${entity}/${bundle}?${params}`,
      }];
      const findRequest = {
        blueprint, bundle, entity, priority, type,
      };

      if (!$createIfNotFound) return { [requestId]: findRequest };

      // A separate create request is only added when $createIfNotFound is true,
      // and its blueprint remains empty unless the find request comes back empty.
      const createIfNotFoundRequestId = `${requestId}/$createIfNotFound:${type}`;
      const createIfNotFoundBlueprint = (_, prior) => {
        const findResults = Object.values(prior).find(sub => sub.requestId === requestId);
        if (findResults && findResults.data > 0) return [];
        const props = dropKeywords(filter);
        if (!props.type) return [];
        const data = farm[entity].create(props);
        return [{
          action: 'create',
          body: fmtLocalData(data),
          headers,
          requestId: createIfNotFoundRequestId,
          uri: `${BASE_URI}/${entity}/${bundle}`,
          waitFor: [requestId],
        }];
      };
      const createIfNotFoundRequest = {
        ...findRequest,
        // Because $find commands are always priority 0, these are always 1.
        priority: 1,
        blueprint: createIfNotFoundBlueprint,
      };
      return {
        [requestId]: findRequest,
        [createIfNotFoundRequestId]: createIfNotFoundRequest,
      };
    },
  };

  function parseSubrequest(subrequest, options = {}, prefix = '$ROOT') {
    const [[k, v], ...rest] = Object.entries(subrequest);
    let opts = { ...options, ...Object.fromEntries(rest) };
    if (k in commands) return commands[k](v, prefix, opts);
    if (rest.length === 0) {
      const joinedOpts = Object.keys(options).join(', ');
      const joinedActs = Object.keys(commands).join(', ');
      const msg = `Missing or invalid command in subrequest at ${prefix}. `
      + `Only the following options or keys were included: ${joinedOpts}. `
      + `Include one of the following valid commands instead: ${joinedActs}.`;
      throw new Error(msg);
    }
    if (isKeyword(k)) opts = { ...opts, [k]: v };
    return parseSubrequest(Object.fromEntries(rest), opts, prefix);
  }

  function chainSubrequests(requests, prior = {}, priority = 0) {
    const [ready, waiting] = partition(r => r.priority === priority, requests);
    const resolveBlueprint = ({ blueprint }) => blueprint(ready, prior, waiting);
    const data = chain(resolveBlueprint, Object.values(ready));
    const promise = farm.remote.request(SUB_URL, { method: 'POST', data })
      .then(concatSubresponses(prior, ready));
    if (Object.keys(waiting).length === 0) return promise;
    return promise.then(done => chainSubrequests(waiting, done, priority + 1));
  }

  return {
    parse: parseSubrequest,
    chain: chainSubrequests,
    send(subrequest = {}, data = null) {
      const prior = { 'ROOT-DATA': { data } };
      const requests = parseSubrequest(subrequest);
      return chainSubrequests(requests, prior);
    },
  };
}
