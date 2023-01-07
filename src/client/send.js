import sendFiles from './file';

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
  return sendFiles(request, entity, options.files).then(sendEntity);
};
