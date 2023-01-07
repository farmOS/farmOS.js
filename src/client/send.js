import compose from 'ramda/src/compose';
import concat from 'ramda/src/concat';
import curryN from 'ramda/src/curryN';
import mergeDeepWithKey from 'ramda/src/mergeDeepWithKey';
import path from 'ramda/src/path';
import pick from 'ramda/src/pick';
import reduce from 'ramda/src/reduce';

// Update the fields on an entity that had files related to it on those fields.
// The responses are from separate requests to send the files, with a special
// file entity's id and type contained in the response data. The updated entity
// is sent in a subsequent request only after all files are sent.
const toResourceId = compose(
  pick(['id', 'type']),
  path(['data', 'data']),
);
const mapResponseData = response =>
  (Array.isArray(response) ? response.map(toResourceId) : toResourceId(response));
const concatRelationshp = (original, updated) =>
  (Array.isArray(original) ? concat(original, updated) : updated);
const updateRelationship = mergeDeepWithKey((key, related, original) =>
  (key === 'data' ? concatRelationshp(original, related) : original));
const updateFileField = reduce((entity, [field, response]) => {
  const relationship = {
    relationships: {
      [field]: {
        data: mapResponseData(response),
      },
    },
  };
  return updateRelationship(entity, relationship);
});

/**
 * @typedef {Object} SendOptions
 * @property {Object} [files]
 */
/**
 * farmOS client method for sending an entity to a Drupal JSON:API server
 * @typedef {Function} sendEntity
 * @param {String} bundle The bundle type (eg, 'activity', 'equipment', etc).
 * @param {Object} entity The entity being sent to the server.
 * @param {SendOptions} [options]
 * @returns {Promise}
 */

/**
 * @type {Function}
 * @param {String} entityName
 * @param {Function} request
 * @returns {sendEntity}
 */
export default (entityName, request) => function send(bundle, entity, options = {}) {
  const post = data => request({
    data: JSON.stringify({ data }),
    method: 'POST',
    url: `/api/${entityName}/${bundle}`,
  });
  const patch = data => request({
    data: JSON.stringify({ data }),
    method: 'PATCH',
    url: `/api/${entityName}/${bundle}/${data.id}`,
  });
  const is404 = error => error.response && error.response.status === 404;

  function sendEntity(data) {
    if (!data.id) return post(data);
    // We assume if an entity has an id it is a PATCH request, but that may not be
    // the case if it has a client-generated id. Such a PATCH request will result
    // in a 404 (NOT FOUND), since the endpoint includes the id. We handle this
    // error with a POST request, but otherwise return a rejected promise.
    return patch(data).catch(e => (is404(e) ? post(data) : Promise.reject(e)));
  }

  if (!options.files) return sendEntity(entity);

  const { files = {} } = options;
  const sendFile = curryN(2, (url, { data = null, filename = 'untitled' } = {}) => {
    if (!data) return Promise.resolve(null);
    const config = {
      data,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `file; filename="${filename}"`,
      },
      method: 'POST',
    };
    return request(url, config);
  });
  const fileRequests = Object.entries(files).map(([field, attributes]) => {
    const url = `/api/${entityName}/${bundle}/${field}`;
    const promise = Array.isArray(attributes)
      ? Promise.all(attributes.map(sendFile(url)))
      : sendFile(url, attributes);
    return promise.then(response => [field, response]);
  });

  return Promise.all(fileRequests)
    .then(updateFileField(entity))
    .then(sendEntity);
};
