import allPass from 'ramda/src/allPass';
import any from 'ramda/src/any';
import assoc from 'ramda/src/assoc';
import chain from 'ramda/src/chain';
import compose from 'ramda/src/compose';
import equals from 'ramda/src/equals';
import evolve from 'ramda/src/evolve';
import rFilter from 'ramda/src/filter';
import hasPath from 'ramda/src/hasPath';
import is from 'ramda/src/is';
import map from 'ramda/src/map';
import mapObjIndexed from 'ramda/src/mapObjIndexed';
import match from 'ramda/src/match';
import mergeRight from 'ramda/src/mergeRight';
import mergeWith from 'ramda/src/mergeWith';
import partition from 'ramda/src/partition';
import path from 'ramda/src/path';
import pick from 'ramda/src/pick';
import pickBy from 'ramda/src/pickBy';
import prop from 'ramda/src/prop';
import reduce from 'ramda/src/reduce';
import sort from 'ramda/src/sort';
import startsWith from 'ramda/src/startsWith';
import test from 'ramda/src/test';
import uniqBy from 'ramda/src/uniqBy';
import { validate } from 'uuid';
import entities from '../../entities';
import { parseEntityType, parseTypeFromFields, splitFilterByType } from '../../types';
import { generateFieldTransforms, transformLocalEntity, transformRemoteEntity } from './transformations';
import { parseFetchParams } from '../fetch';

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
const isSubrequest = o => any(isKeyword, Object.keys(o || {}));
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
const contentIdRE = /([^#\s]+)((?:#(?:body|uri)\{\d\}){0,2}$)/;
const bodyRE = /(#body\{\d+\})/;
const uriRE = /(#uri\{\d+\})/;
function parseContentId(string) {
  const [contentId, requestId, fragment] = match(contentIdRE, string);
  const [, body = null] = match(bodyRE, fragment || '');
  const [, uri = null] = match(uriRE, fragment || '');
  return {
    contentId, requestId, fragment, body, uri,
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
// Formatter for JSONPath tokens, defaults to one-to-one ('object') relation.
const fmtDataToken = (requestId, field, relation = 'object') =>
  `{{${requestId}.body@$.data${relation === 'array' ? '[*]' : ''}.${field}}}`;
// Format the data token, but parse the requestId first to determine if it's for
// a one-to-one or one-to-many relationship, based on the command.
function parseDataToken(requestId, field) {
  const command = parseCommand(requestId);
  const relation = commandRelations[command];
  return fmtDataToken(requestId, field, relation);
}

// Determine if a relationship for a given schema is one-to-one (ie, 'object')
// or one-to-many (ie, 'array').
const typeOfRelationship = (schema, field) => path([
  'properties', 'relationships', 'properties', field, 'type',
], schema);

const fmtRequestId = (prefix, command, type) => `${prefix}::${command}:${type}`;

// Wrapper merely provides an instance of FarmObject via dependency injection.
export default function withSubrequests(model, connection) {
  // Called before any requests have been sent, unlike resolveDependencies. This
  // is mutually recursive with parseSubrequests, and is how each subrequest and
  // its child subrequests are assigned their priority number, which accordingly
  // determines the batch of subrequests in which it will be sent to the server.
  function parseDependentFields(fields, command, prefix) {
    const [dependentFields, constants] = splitFields(fields);
    const { bundle, entity, type } = parseTypeFromFields(constants);
    const requestId = fmtRequestId(prefix, command, type);
    const dependencies = {}; let priority = 0; const subrequests = {};
    Object.entries(dependentFields).forEach(([field, sub]) => {
      const nextPrefix = `${requestId}.${field}`;
      dependencies[field] = [];
      const requests = parseSubrequest(sub, nextPrefix);
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
    const schema = model.schema.get(entity, bundle);

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
            id: fmtDataToken(reqId, 'id'),
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
          const dRevId = 'attributes.drupal_internal__revision_id';
          const dId = 'attributes.drupal_internal__id';
          const data = [{
            id: parseDataToken(reqId, 'id'),
            type: parseDataToken(reqId, 'type'),
            // The target's revision id is required primarily for quantities,
            // but it doesn't hurt to add it for all others as well.
            meta: {
              target_revision_id: parseDataToken(reqId, dRevId),
              drupal_internal__target_id: parseDataToken(reqId, dId),
            },
          }];
          const basePath = `${BASE_URI}/${entity}/${bundle}/${fmtDataToken(requestId, 'id')}`;
          const blueprint = {
            requestId: `${requestId}.${field}`,
            // Note the entity's relationship endpoint is used here.
            uri: `${basePath}/relationships/${field}`,
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
    const transforms = generateFieldTransforms(model.schema.get());
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
    let { [shortName]: { [method]: fn } } = model;
    if (typeof fn !== 'function') ({ [shortName]: { [method]: fn } } = connection);
    if (typeof fn !== 'function') return null;
    return fn(...args);
  }

  // const { compare } = new Intl.Collator();
  // const sortKeys = obj => sort(([k1], [k2]) => compare(k1, k2), Object.keys(obj));
  // function getCommandFingerprint(keyword, args, prefix, options) {
  // }
  // function isOneTimeCommand(command, options = {}) {
  //   if (options.$once) return true;
  //   if (command.startsWith('$find') && options.$createIfNotFound) return true;
  //   return false;
  // }
  const commands = {
    map(keyword, args, prefix, options) {
      const command = this[keyword];
      if (Array.isArray(args)) {
        // console.log('MAPPING: ', keyword);
        // console.log('args', args);
        // console.log('options', options);
        // if (isOneTimeCommand(keyword, options)) {
        //   const tailOptions = { ...options, $createIfNotFound: false, $once: false };
        //   return args.reduce((subs, argument, i) => {
        //     const headIndex = args.findIndex(equals(argument));
        //     const opts = headIndex === i ? options : tailOptions;
        //     const sub = command(argument, `${prefix}.${i}`, opts);
        //     return { ...subs, ...sub };
        //   }, {});
        // }
        return args.reduce((subs, value, i) => ({
          ...subs,
          ...command(value, `${prefix}.${i}`, options),
        }), {});
      }
      return command(args, prefix, options);
    },
    $create(fields, prefix) {
      if (Array.isArray(fields)) return this.map('$create', fields, prefix);
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
      const schemata = model.schema.get();
      const filterTransforms = generateFieldTransforms(schemata);
      const validTypes = Object.entries(schemata)
        .flatMap(([e, s]) => Object.keys(s).map(b => `${e}--${b}`));
      const filtersByType = splitFilterByType(filter, validTypes);

      const subrequests = {};
      filtersByType.forEach(({ type, filter: typeFilter }) => {
        const { entity, bundle } = parseEntityType(type);
        // The initial fetch request with filter & other search parameters.
        const requestId = fmtRequestId(prefix, '$find', type);
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
      const requestId = fmtRequestId(prefix, '$createIfNotFound', type);
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
      // $createIfNotFound is a one-time-command, which should not be repeated,
      // so provide this fingerprint so it can be deduplicated.
      const fingerprint = {
        keyword: '$createIfNotFound', args: filter, prefix, options: opts,
      };
      subrequests[requestId] = {
        blueprint, bundle, entity, fingerprint, priority, type,
      };
      return subrequests;
    },
    $update(fields, prefix) {
      if (Array.isArray(fields)) this.map('$update', fields, prefix);
      if (!validate(fields.id)) return commands.$create(fields, prefix);
      const fieldData = parseDependentFields(fields, '$update', prefix);
      const {
        bundle, constants, dependencies, entity, priority, subrequests, requestId, type,
      } = fieldData;
      const blueprint = (ready, prior) => {
        const {
          resolved, posthoc, unresolved, waitFor,
        } = resolveDependencies(fieldData, ready, prior);
        unresolved.forEach((field) => {
          const msg = `Unable to resolve ${field} field while updating `
            + `${bundle} ${entity}. Request ID: ${requestId}`;
          console.warn(msg);
        });
        const action = 'update';
        const data = callEntityMethod(entity, 'update', constants, resolved);
        if (!data) return [];
        const body = fmtLocalData(data);
        const uri = `${BASE_URI}/${entity}/${bundle}/${fields.id}`;
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
  };

  const splitCommandsAndOptions = compose(
    map(Object.fromEntries),
    partition(([key]) => key in commands),
    Object.entries,
  );

  // Commands like $createIfNotFound should only be used once, so remove duplicates.
  function dedupeOneTimeCommands(subrequests) {
    const replacements = new Map();
    const deduped = Object.entries(subrequests).reduce((subs, [requestId, sub], i, all) => {
      if (is(Object, sub.fingerprint)) {
        if (sub.fingerprint.keyword === '$createIfNotFound') {
          const isEqual = compose(
            equals(sub.fingerprint.args),
            path([1, 'fingerprint', 'args']),
          );
          const firstIndex = all.findIndex(isEqual);
          if (firstIndex !== i) {
            const [firstReqId] = all[firstIndex];
            replacements.set(requestId, firstReqId);
            return subs;
          }
        }
      }
      return { ...subs, [requestId]: sub };
    }, {});
    // Search for JSONPath tokens that contain any of the duplicate request ids
    // and replace them with the request id of the first subrequest that matched
    // the same fingerprint.
    const replaceTokens = initStr => Array.from(replacements.entries())
      .reduce((prev, [dupeReqId, firstReqId]) => {
        // Use the RegExp constructor with a template literal as the pattern, so
        // the function parameterss can be included in the expression, bounded
        // by "{{" and ".body@$" to make sure it matches only the full request id.
        const tokenPattern = `\\{\\{${dupeReqId}.body@$`
          .replaceAll('$', '\\$')
          .replaceAll('.', '\\.');
        const tokenRE = new RegExp(tokenPattern, 'g');
        return prev.replaceAll(tokenRE, `{{${firstReqId}.body@$`);
      }, initStr);
    // Swap an entire string for another if it's a duplicate.
    const swap = reqId => (replacements.has(reqId) ? replacements.get(reqId) : reqId);
    const replaceOneTimeCommands = map(evolve({
      blueprint: map(evolve({
        body: replaceTokens,
        uri: replaceTokens,
        waitFor: map(swap),
      })),
      dependencies: map(map(swap)),
    }));
    const replaced = replaceOneTimeCommands(deduped);
    return replaced;
  }

  /** @type {(subrequest?: Object, prefix?: String) => Object.<string, object>} */
  function parseSubrequest(subrequest = {}, prefix = '$ROOT') {
    const [comms, options] = splitCommandsAndOptions(subrequest);
    if (Object.keys(comms).length < 1) {
      const joinedOpts = Object.keys(options).join(', ');
      const joinedActs = Object.keys(commands).join(', ');
      const msg = `Missing or invalid command in subrequest at ${prefix}. `
      + `Only the following options or keys were included: ${joinedOpts}. `
      + `Include one of the following valid commands instead: ${joinedActs}.`;
      throw new Error(msg);
    }
    return Object.entries(comms).reduce((prevSubs, [keyword, args]) => {
      const nextSub = commands.map(keyword, args, prefix, options);
      return { ...prevSubs, ...nextSub };
    }, {});
  }

  /** @type {(requests: Object, responses?: Array, priority?: Number) => Promise<Array>} */
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
      dedupeOneTimeCommands,
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
    const promise = connection.request(SUB_URL, { method: 'POST', data })
      .then(concatSubresponses);
    if (Object.keys(next).length === 0) return promise;
    return promise.then(done => chainSubrequests(next, done, priority + 1));
  }

  // Convert the initial data of a send request, either an entity or an array of
  // entities, into a subrequest with either a single $create or $update
  // command, depending on
  function toSubrequest(data, options) {
    if (Array.isArray(data)) {
      const concatSubs = (a, b) => [].concat(a).concat(b);
      return data.reduce((prevSubs, subData) => {
        const nextSub = toSubrequest(subData, options);
        return mergeWith(concatSubs, prevSubs, nextSub);
      }, {});
    }
    let { subrequest: fields = {} } = options;
    if (is(Function, options.subrequest)) fields = options.subrequest(data);
    const isPostRequest = !data.id || model.meta.isUnsynced(data);
    const command = isPostRequest ? '$create' : '$update';
    const fieldTransforms = generateFieldTransforms(model.schema.get());
    const remote = transformLocalEntity(data, fieldTransforms);
    const {
      id, type, attributes, relationships,
    } = remote;
    fields = { ...relationships, ...fields };
    const argument = {
      id, type, ...attributes, ...fields,
    };
    return { [command]: argument };
  }

  const rootRE = /^\$ROOT(\.?\d?)::\$(create|update):\w+--\w+$/g;
  const isRootRequest = compose(
    test(rootRE),
    prop('requestId'),
  );
  const hasData = hasPath(['body', 'data']);
  const hasRootData = allPass([isRootRequest, hasData]);
  const transformSubresponses = compose(
    map(transformRemoteEntity(true)),
    map(path(['body', 'data'])),
    rFilter(hasRootData),
    chain(Object.values),
    map(prop('data')),
  );
  return function sendWithSubrequest(data, options) {
    const subrequest = toSubrequest(data, options);
    const requests = parseSubrequest(subrequest, '$ROOT');
    return chainSubrequests(requests).then((raw) => {
      const responses = transformSubresponses(raw);
      return responses;
    });
  };
}
