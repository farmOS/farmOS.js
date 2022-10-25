import any from 'ramda/src/any';
import assoc from 'ramda/src/assoc';
import chain from 'ramda/src/chain';
import compose from 'ramda/src/compose';
import evolve from 'ramda/src/evolve';
import rFilter from 'ramda/src/filter';
import map from 'ramda/src/map';
import mapObjIndexed from 'ramda/src/mapObjIndexed';
import match from 'ramda/src/match';
import mergeRight from 'ramda/src/mergeRight';
import partition from 'ramda/src/partition';
import path from 'ramda/src/path';
import pick from 'ramda/src/pick';
import pickBy from 'ramda/src/pickBy';
import prop from 'ramda/src/prop';
import reduce from 'ramda/src/reduce';
import sort from 'ramda/src/sort';
import startsWith from 'ramda/src/startsWith';
import uniqBy from 'ramda/src/uniqBy';
import entities from '../entities';
import { parseEntityType, parseTypeFromFields, splitFilterByType } from '../types';
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

// For use with fetch filters, to keep only their constant fields and drop any
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

function parseCommand(reqId) {
  const pathSegments = reqId.split('::');
  const lastPathSegment = pathSegments[pathSegments.length - 1];
  const [command] = lastPathSegment.split(':');
  return command;
}
const commandRelations = {
  $find: 'array',
  $create: 'object',
  $createIfNotFound: 'object',
};
function parseDataToken(requestId) {
  const fieldCommand = parseCommand(requestId);
  const wildcard = commandRelations[fieldCommand] === 'array' ? '[*]' : '';
  return `${requestId}.body@$.data${wildcard}`;
}

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
    const requestId = `${prefix}::${command}:${type}`;
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
      rFilter((data) => data && 'id' in data && 'type' in data),
      // Flatten the array of nested data objects/arrays.
      chain(path(['body', 'data'])),
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
      const depPrefix = `${requestId}.${field}::`;
      const trimPrefix = d => d.replace(depPrefix, '');
      const isDirect = d => !trimPrefix(d).includes('::');
      const directDeps = fieldDeps.filter(isDirect);
      const concurrentIds = Object.keys(ready).filter(id => directDeps.includes(id));
      const resources = mapDependenciesToResources(directDeps);
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
            id: `{{${reqId}.body@$.data.id}}`,
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
          const dataToken = parseDataToken(reqId);
          const data = [{
            id: `{{${dataToken}.id}}`,
            type: `{{${dataToken}.type}}`,
            // The target's revision id is required primarily for quantities,
            // but it doesn't hurt to add it for all others as well.
            meta: {
              target_revision_id: `{{${dataToken}.attributes.drupal_internal__revision_id}}`,
              drupal_internal__target_id: `{{${dataToken}.attributes.drupal_internal__id}}`,
            },
          }];
          const blueprint = {
            requestId: `${requestId}.${field}`,
            // Note the entity's relationship endpoint is used here.
            uri: `${BASE_URI}/${entity}/${bundle}/${uuid}/relationships/${field}`,
            waitFor: [reqId, requestId],
            action: 'create',
            headers,
            body: JSON.stringify({ data }),
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

  // A safe way of calling entity methods, such as `farm.term.create()`.
  function callEntityMethod(entity, method, ...args) {
    if (typeof entity !== 'string' || !(entity in entities)) return null;
    const { [entity]: { nomenclature: { shortName } } } = entities;
    if (!shortName || typeof method !== 'string') return null;
    const { [shortName]: { [method]: fn } } = farm;
    if (typeof fn !== 'function') return null;
    return fn(...args);
  }

  const commands = {
    $create(fields, prefix) {
      const fieldData = parseDependentFields(fields, '$create', prefix);
      const {
        bundle, constants, dependencies, entity, priority, subrequests, requestId, type,
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
        const data = callEntityMethod(entity, 'create', props);
        if (!data) return [];
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
          blueprint, bundle, dependencies, entity, priority, type,
        },
      };
    },
    $find(filter, prefix, opts) {
      const { $createIfNotFound, $limit, $sort } = opts;
      const schemata = farm.schema.get();
      const filterTransforms = generateFieldTransforms(schemata);
      const validTypes = Object.entries(schemata)
        .flatMap(([e, s]) => Object.keys(s).map(b => `${e}--${b}`));
      const filtersByType = splitFilterByType(filter, validTypes);

      const subrequests = {};
      filtersByType.forEach(({ type, filter: typeFilter }) => {
        const { entity, bundle } = parseEntityType(type);
        // The initial fetch request with filter & other search parameters.
        const requestId = `${prefix}::$find:${type}`;
        // Nested subrequests are disallowed in $find commands, meaning they have
        // no dependencies, and so should always be included in the first batch of
        // subrequests; hence, they will always have a priority of 0.
        const priority = 0;
        const params = parseFetchParams({
          filter: typeFilter, filterTransforms, limit: $limit, sort: $sort,
        });
        const blueprint = () => [{
          action: 'view',
          headers,
          requestId,
          uri: `${BASE_URI}/${entity}/${bundle}?${params}`,
        }];
        subrequests[requestId] = {
          blueprint, bundle, entity, priority, type,
        };
      });

      if (!$createIfNotFound || validTypes.length < 1) return subrequests;

      // Arbitrarily pop the first type.
      const [{ type, filter: typeFilter }] = filtersByType;
      const { entity, bundle } = parseEntityType(type);
      const requestId = `${prefix}::$createIfNotFound:${type}`;
      // A list of request ids is created before the above requestId is added to
      // the subrequests object, and before the blueprint is evaluated.
      const findRequestIds = Object.keys(subrequests);
      // A separate create request is only added when $createIfNotFound is true;
      // Even then, its blueprint returns the empty array (ie, no-op),
      // unless all prior find requests come back empty.
      const blueprint = (_, prior) => {
        const results = Object.values(prior)
          .filter(sub => findRequestIds.includes(sub.requestId) && sub.body)
          .flatMap((sub) => sub.body.data || []);
        if (results.length > 0) return [];
        const props = { ...dropKeywords(typeFilter), type };
        const data = callEntityMethod(entity, 'create', props);
        if (!data) return [];
        return [{
          action: 'create',
          body: fmtLocalData(data),
          headers,
          requestId,
          uri: `${BASE_URI}/${entity}/${bundle}`,
        }];
      };
      // Because $find requests are always priority 0, this will always be 1.
      const priority = 1;
      subrequests[requestId] = {
        blueprint, bundle, entity, priority, type,
      };
      return subrequests;
    },
  };

  function parseSubrequest(subrequest = {}, options = {}, prefix = '$ROOT') {
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

  function chainSubrequests(requests, responses = [], priority = 0) {
    // Separate requests with the current priority level from all later requests.
    const [ready, next] = partition(r => r.priority === priority, requests);
    // Each response contains one "batch" (ie, the same priority) of subresponses
    // but blueprint functions expect one big object containing all priorities.
    const mergeResponses = compose(
      // Using mergeRight as the reducer merges all batches of subresponses into a
      // single object. Because they're keyed to contentId, they shouldn't collide.
      reduce(mergeRight, {}),
      // The data property on each response object contains the subresponses.
      map(prop('data')),
    );
    const prior = mergeResponses(responses);

    // Determine if a request (req) depends upon another separate request,
    // based on the former's dependencies and the latter's requestId (id).
    const isDependent = (req, id) => {
      const { dependencies = {} } = req;
      const allDeps = Object.values(dependencies).flat();
      return allDeps.includes(id);
    };
    // Even once ready requests have been partitioned from pending ones, they
    // must still be sorted according to which ones depend upon each other. This
    // prevents subrequests from referencing dependencies that have resolved to
    // a 'noop' will be removed from the collection of concurrent subrequests.
    function sortByDependencies(unsorted, sorted = []) {
      const [head, ...tail] = unsorted;
      if (tail.length < 1) return [...sorted, head];
      const [idA, reqA] = head;
      const aDependsOn = []; const dependsOnA = []; const independent = [];
      tail.forEach(([idB, reqB]) => {
        if (isDependent(reqA, idB)) {
          aDependsOn.push([idB, reqB]);
        } else if (isDependent(reqB, idA)) {
          dependsOnA.push([idB, reqB]);
        } else {
          independent.push([idB, reqB]);
        }
      });
      const circularDependency = !aDependsOn.every(([i]) => dependsOnA.every(([j]) => i !== j));
      if (circularDependency) throw new Error('Circular dependency detected!');
      if (aDependsOn.length === 0) {
        return sortByDependencies(tail, [...sorted, head]);
      }
      const resorted = [...independent, ...aDependsOn, head, ...dependsOnA];
      return sortByDependencies(resorted, sorted);
    }

    // Once they've been sorted, the blueprints of ready requests must be evaluated
    // sequentially, and if their blueprint is empty (ie, a 'noop'), they must be
    // removed from the final list of concurrent requests, b/c leaving them in can
    // result in a server error if it encounters a requestId it doesn't recognize.
    const concatConcurrentRequests = reduce((concurrent, [reqId, req]) => {
      const resolved = evolve({
        blueprint: bp => bp(concurrent, prior),
      }, req);
      if (resolved.blueprint.length < 1) return concurrent;
      return assoc(reqId, resolved, concurrent);
    }, {});
    // Combine all the above steps to take a batch of ready requests and return
    // the final blueprint array to send to the server's subrequest endpoint.
    const resolveBlueprints = compose(
      chain(prop('blueprint')),
      Object.values,
      concatConcurrentRequests,
      sortByDependencies,
      Object.entries,
    );
    function pruneUnmetDependencies(blueprint) {
      const requestIds = blueprint.map(b => b.requestId);
      const pruned = blueprint.filter(({ waitFor = [] }) =>
        waitFor.length < 1 || waitFor.every(id => requestIds.includes(id)));
      if (pruned.length === blueprint.length || pruned.length === 0) return pruned;
      return pruneUnmetDependencies(pruned);
    }
    const concatBlueprints = compose(
      pruneUnmetDependencies,
      resolveBlueprints,
    );

    // Merge a batch of subresponses w/ their original request data.
    const mergeResponseWithRequest = evolve({
      // The data property on the main response object contains the subresponses,
      // each keyed to their contentId. Map over each subresponse and match it with
      // its corresponding request, merge them into one object, and parse the body.
      data: mapObjIndexed(compose(
        // Parse the body of each subresponse.
        evolve({ body: JSON.parse }),
        // Merge the request data with the response data.
        sub => mergeRight(requests[sub.requestId], sub),
        // Parse the contentId to get the original requestId, key and index, then
        // merge those properties with the rest of the subresponse.
        (sub, contentId) => mergeRight(parseContentId(contentId), sub),
      )),
    });

    // Add an incoming response, along w/ its request data, to the list of
    // prior responses, so they can be returned to the caller, or passed to the
    // next recursive call of chainSubrequst.
    const concatSubresponses = (response) => {
      const merged = mergeResponseWithRequest(response);
      return responses.concat(merged);
    };

    const data = concatBlueprints(ready);
    const promise = farm.remote.request(SUB_URL, { method: 'POST', data })
      .then(concatSubresponses);
    if (Object.keys(next).length === 0) return promise;
    return promise.then(done => chainSubrequests(next, done, priority + 1));
  }

  return {
    parse: parseSubrequest,
    chain: chainSubrequests,
    send(subrequest, data) {
      const root = { data: { $ROOT: { data } } };
      const responses = [];
      if (data) responses.push(root);
      const requests = parseSubrequest(subrequest);
      return chainSubrequests(requests, responses);
    },
  };
}
