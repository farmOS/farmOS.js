/* eslint no-use-before-define: ["error", { "functions": false }] */
/* eslint no-console: ["warn", { "allow": ["warn"] }] */
import any from 'ramda/src/any';
import chain from 'ramda/src/chain';
import compose from 'ramda/src/compose';
import drop from 'ramda/src/drop';
import evolve from 'ramda/src/evolve';
import head from 'ramda/src/head';
import map from 'ramda/src/map';
import match from 'ramda/src/match';
import mergeLeft from 'ramda/src/mergeLeft';
import mergeWith from 'ramda/src/mergeWith';
import partition from 'ramda/src/partition';
import path from 'ramda/src/path';
import pick from 'ramda/src/pick';
import prop from 'ramda/src/prop';
import startsWith from 'ramda/src/startsWith';
import uniqBy from 'ramda/src/uniqBy';
import { generateFieldTransforms, transformLocalEntity } from './adapter/transformations';

// Constants for sending requests via Drupal's JSON:API module.
const SUB_URL = '/api/subrequests?_format=json';
const headers = {
  Accept: 'application/vnd.api+json',
  'Content-Type': 'application/vnd.api+json',
};

// Fields that contain a subrequest are separated as dependent fields, distinct
// from constant fields, whose values are known immediately.
const isKeyword = startsWith('$');
const isSubrequest = o => any(isKeyword, Object.keys(o));
const splitFields = partition(isSubrequest);

// Normalize the entity type.
const entityTypeRegEx = /([a-z]+)--([a-z]+)/;
const parseType = compose(drop(1), match(entityTypeRegEx));
function parseEntityType(fields) {
  const { type } = fields;
  const [entity, bundle] = parseType(type);
  return { entity, bundle, type };
}

// Subrequests that contain a JSONPath wildcard may have multiple subresponses,
// which are each given Content-Ids comprised of the original requestId appended
// w/ an additional fragment, which is itself comprised of the blueprint property
// where the wildcard was found plus an index. For instance, if a subrequest is
// given a uri of '/api/log/input/{{find-logs.body@$.data[*].id}}' and has a
// requestId of 'update-input', the first two subresponse that corresponds to it
// will have Content-Ids of 'update-input#uri{0}' and 'update-input#uri{1}',
// respectively. Therefore, each Content-Id is parsed so the subresponse can be
// more easily matched with its corresponding subrequest.
const contentIdRE = /([^#\s]+)(#(body|uri)\{(\d)\})?$/;
function parseContentId(string) {
  const [
    contentId, requestId, fragment, property, index,
  ] = match(contentIdRE, string);
  return {
    contentId, requestId, fragment, property, index,
  };
}

// Determine if a relationship for a given schema is one-to-one (ie, 'object')
// or one-to-many (ie, 'array').
const typeOfRelationship = (schema, field) => path([
  'properties', 'relationships', 'properties', field, 'type',
], schema);

// Wrapper merely provides an instance of FarmObject via dependency injection.
export default function makeSendWithSubrequest(farm) {
  // Called before any requests have been sent, unlike resolveDependencies. This
  // is mutually recursive with parseSubrequests, and is how each subrequest and
  // its child subrequests are assigned their priority number, which accordingly
  // determines in which batch of subrequests each is sent to the server.
  function parseDependentFields(fields, action, prefix) {
    const [dependentFields, constants] = splitFields(fields);
    const { bundle, entity, type } = parseEntityType(constants);
    const requestId = `${prefix}/$${action}:${type}`;
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
  // of requests can be resolved to their actual values, and concurrent dependencies
  // (ie, dependencies that will be part of the same batch) can be suitably
  // formatted according to the JSONPath spec.
  function resolveDependencies(fieldData, ready, prior) {
    const {
      bundle, dependencies, entity, requestId,
    } = fieldData;
    const schema = farm.schema.get(entity, bundle);

    // Resolved fields include data from prior request batches, as well as concurrent
    // requests that do not require a post hoc subrequest.
    const resolved = {}; const unresolved = [];
    // Post hoc subrequests are concurrent blueprints for creating relationships
    // that must be added to the entity separately from the main 'create'
    // subrequest, using the entity's relationship endpoint. This is likely b/c
    // the dependency uses a JSONPath wildcard, which can't be resolved to a
    // resource identifier w/o a separate subrequest.
    const posthoc = [];
    // Only concurrent reqIds are added to waitFor, which is why it is done here
    // and is not the sole responsibility of the actions.
    const waitFor = [];

    // Returns the blueprint for a post hoc subrequest to create a one-to-many
    // relationship that depends on a concurrent subrequest.
    function posthocBlueprint(dependentRequestId, dependentField) {
      const uuid = `{{${requestId}.body@$.data.id}}`;
      const blueprint = {
        requestId: `${requestId}.${dependentField}`,
        // Note the entity's relationship endpoint is used here.
        uri: `/api/${entity}/${bundle}/${uuid}/relationships/${dependentField}`,
        waitFor: [requestId],
        action: 'create',
        headers,
        body: JSON.stringify({
          data: [{
            id: `{{${dependentRequestId}.body@$.data[*].id}}`,
            type: path([dependentRequestId, 'type'], ready),
          }],
        }),
      };
      return blueprint;
    }

    // Helpers for resolving resource identifiers from prior requests.
    const pickResourceIdentifier = pick(['id', 'type']);
    const findPriorData = id => path([id, 'data'], prior);
    // For one-to-one relationships.
    const takeFirstResolved = compose(
      pickResourceIdentifier,
      findPriorData,
      head,
    );
    // For one-to-many relationships.
    const concatAllResolved = compose(
      uniqBy(prop('id')),
      chain(pickResourceIdentifier),
      map(findPriorData),
    );

    // Iterate over all dependencies, resolving their corresponding fields using
    // the most up-to-date (highest priority) data available.
    Object.entries(dependencies).forEach(([field, fieldDeps]) => {
      // 'object' === ONE-TO-ONE; 'array' === ONE-TO-MANY;
      const relation = typeOfRelationship(schema, field);
      const concurrentIds = Object.keys(ready).filter(fieldDeps.includes);
      const isResolved = compose(fieldDeps.includes, prop('requestId'), parseContentId);
      const resolvedIds = Object.keys(prior).filter(isResolved);
      // Sort by highest priority, which will also be the most recent. It may also
      // be useful in the future to sort by parsing the requestId as a tie-breaker,
      // but for now it's simpler to take one more-or-less at random.
      resolvedIds.sort((a, b) => prior[a].priority - prior[b].priority);
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
          const id = `{{${reqId}.body@$.id}}`;
          const type = path([reqId, 'type'], ready);
          resolved[field] = { id, type };
        } else if (resolvedIds.length > 0) {
          resolved[field] = takeFirstResolved(resolvedIds);
        } else {
          unresolved.push(field);
        }
      // ONE-TO-MANY RELATIONSHIPS
      } else if (relation === 'array') {
        // Concurrent dependencies will be added in a separate subrequest.
        concurrentIds.forEach((reqId) => {
          const blueprint = posthocBlueprint(reqId, field);
          posthoc.push(blueprint);
        });
        // Only dependencies from prior request batches can be fully resolved.
        resolved[field] = concatAllResolved(resolvedIds);
      } else {
        console.warn(`Uknown field in subrequest for ${bundle} ${entity}: ${field}`);
      }
    });

    return {
      resolved, posthoc, unresolved, waitFor,
    };
  }

  // Convert an entity or array of entities into Drupal format, then stringify.
  function fmtLocalData(entity, raw) {
    const transforms = generateFieldTransforms(farm.schema.get());
    const t = d => transformLocalEntity(entity, d, transforms);
    const data = Array.isArray(raw) ? raw.map(t) : t(raw);
    return JSON.stringify({ data });
  }

  const actions = {
    $create(fields, prefix) {
      const action = 'create';
      const fieldData = parseDependentFields(fields, action, prefix);
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
        const data = farm[entity].create(props);
        const body = fmtLocalData(entity, data);
        const uri = `/api/${entity}/${bundle}`;
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
    // $find(filter, prefix, opts) {
    //   const action = 'view';
    //   const headers = fetchHeaders;
    //   const { $createIfNotFound, $limit, $sort } = opts;
    // },
    // $update(fields, prefix, opts) {
    //   const action = 'update';
    //   const headers = headers;
    //   const { $limit, $sort } = opts;
    //   const dependencies = [];
    // },
  };

  function parseSubrequest(subrequest, options = {}, prefix = 'root') {
    const [[k, v], ...rest] = Object.entries(subrequest);
    let opts = { ...options, ...Object.fromEntries(rest) };
    if (k in actions) return actions[k](v, prefix, opts);
    if (rest.length === 0) {
      const msg = `Missing or invalid action operator in subrequest at ${prefix}. `
      + `Only the following options or keys were included: ${Object.keys(options).join(', ')}. `
      + `Include one of the following valid actions instead: ${Object.keys(actions).join(', ')}.`;
      throw new Error(msg);
    }
    if (isKeyword(k)) opts = { ...opts, [k]: v };
    return parseSubrequest(Object.fromEntries(rest), opts, prefix);
  }

  // Merge the request data with the response data and parse the body's JSON.
  function concatSubresponses(response, concurrent = {}, prior = {}) {
    const merged = mergeWith(mergeLeft, response.data, concurrent);
    const subresponses = map(evolve({ body: JSON.parse }), merged);
    return { ...prior, ...subresponses };
  }

  function chainRequests(prior, requests, priority = 0) {
    const [ready, waiting] = partition(r => r.priority === priority, requests);
    const resolveBlueprint = ({ blueprint }) => blueprint(ready, prior, waiting);
    const data = chain(resolveBlueprint, Object.values(ready));
    const promise = farm.remote.request(SUB_URL, { method: 'POST', data });
    if (Object.keys(waiting).length === 0) return promise;
    return promise.then((response) => {
      const subresponses = concatSubresponses(response, ready, prior);
      return chainRequests(subresponses, waiting, priority + 1);
    });
  }

  return function sendWithSubrequest(data, subrequest = {}) {
    const prior = { 'ROOT-DATA': { data } };
    const requests = parseSubrequest(subrequest);
    return chainRequests(prior, requests);
  };
}
