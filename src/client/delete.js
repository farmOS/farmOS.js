/**
 * farmOS client method for sending an entity to a Drupal JSON:API server
 * @typedef {Function} deleteEntity
 * @param {String} bundle The bundle type (eg, 'activity', 'equipment', etc).
 * @param {Object} entity The entity being sent to the server.
 * @returns {Promise}
 */

/**
 * @param {String} entity
 * @param {Function} request
 * @returns {deleteEntity}
 */
const deleteEntity = (entity, request) => (bundle, id) => request(
  `/api/${entity}/${bundle}/${id}`,
  { method: 'DELETE' },
);

export default deleteEntity;
