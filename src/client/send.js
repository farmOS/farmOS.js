/**
 * farmOS client method for sending an entity to a Drupal JSON:API server
 * @typedef {Function} sendEntity
 * @param {String} bundle The bundle type (eg, 'activity', 'equipment', etc).
 * @param {Object} entity The entity being sent to the server.
 * @returns {Promise}
 */

/**
 * @param {String} entityName
 * @param {Function} request
 * @returns {sendEntity}
 */
const sendEntity = (entityName, request) => (bundle, entity) => {
  const data = JSON.stringify({ data: entity });
  const postURL = `/api/${entityName}/${bundle}`;
  const postOptions = { method: 'POST', data };
  if (!entity.id) return request(postURL, postOptions);
  // We assume if an entity has an id it is a PATCH request, but that may not be
  // the case if it has a client-generated id. Such a PATCH request will result
  // in a 404 (NOT FOUND), since the endpoint includes the id. We handle this
  // error with a POST request, but otherwise return a rejected promise.
  const patchURL = `/api/${entityName}/${bundle}/${entity.id}`;
  const patchOptions = { method: 'PATCH', data };
  const is404 = error => error.response && error.response.status === 404;
  return request(patchURL, patchOptions)
    .catch(e => (is404(e) ? request(postURL, postOptions) : Promise.reject(e)));
};

export default sendEntity;
