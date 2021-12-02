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
 * @param {String} bundle
 * @returns {(entity: String) => Promise}
 */
const postEntity = (entityName, request, bundle) => data =>
  request(`/api/${entityName}/${bundle}`, { method: 'POST', data });

/**
 * @param {String} entityName
 * @param {Function} request
 * @returns {sendEntity}
 */
const sendEntity = (entityName, request) => (bundle, entity) => {
  const data = JSON.stringify({ data: entity });
  const post = postEntity(entityName, request, bundle);
  // We assume if an entity has an id it is a PATCH request, but that may not be
  // the case if it has a client-generated id. Such a PATCH request will result
  // in a 404 (NOT FOUND), since the endpoint includes the id. We handle this
  // error with a POST request, but otherwise return a rejected promise.
  if ('id' in entity) {
    const patchURL = `/api/${entityName}/${bundle}/${entity.id}`;
    const patchOptions = { method: 'PATCH', data };
    const patchRequest = request(patchURL, patchOptions);
    const intercept404 = error =>
      (error.response.status === 404 ? post(data) : Promise.reject(error));
    return patchRequest.catch(intercept404);
  }
  return post(data);
};

export default sendEntity;
