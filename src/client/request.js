import has from 'ramda/src/has.js';
import ifElse from 'ramda/src/ifElse.js';
import parseFilter from './parseFilter.js';

const parseLimit = limit =>
  (Number.isInteger(limit) && limit > 0 ? `&page[limit]=${limit}` : '');
const parseFetchParams = ({ filter = {}, filterTransforms, limit }) =>
  parseFilter(filter, { filterTransforms }) + parseLimit(limit);

export default function farmRequest(client) {
  const request = (endpoint, { method = 'GET', ...data } = {}) =>
    client(endpoint, { method, data: JSON.stringify(data) });

  const fetchEntity = entity => (bundle, options = {}) =>
    request(`/api/${entity}/${bundle}?${parseFetchParams(options)}`);

  const postEntity = entity => (bundle, data) =>
    request(`/api/${entity}/${bundle}`, { method: 'POST', data });
  // We assume if an entity has an id it is a PATCH request, but that may not be
  // the case if it has a client-generated id. Such a PATCH request will result
  // in a 404 (NOT FOUND), since the endpoint includes the id, so we handle this
  // error with a POST request instead.
  const handlePatch404 = (entity, bundle, data) => ifElse(
    e => +e.response.status === 404,
    () => postEntity(entity)(bundle, data),
    Promise.reject,
  );
  const patchEntity = entity => (bundle, data) =>
    request(`/api/${entity}/${bundle}/${data.id}`, { method: 'PATCH', data })
      .catch(handlePatch404(entity, bundle, data));
  const sendEntity = entity => ifElse(
    (_, data) => has('id', data),
    patchEntity(entity),
    postEntity(entity),
  );

  const deleteEntity = entity => (bundle, id) => request(
    `/api/${entity}/${bundle}/${id}`,
    { method: 'DELETE' },
  );

  return {
    request, fetchEntity, sendEntity, deleteEntity,
  };
}
