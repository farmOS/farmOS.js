import axios from 'axios';
import map from 'ramda/src/map.js';
import prop from 'ramda/src/prop.js';
import farmRequest from './request.js';
import oauth from './oauth.js';
import typeToBundle from './typeToBundle.js';
import entities, { entityMethods } from '../entities.js';

const entityNames = Object.keys(entities);

export default function client(host, opts) {
  const {
    clientId,
    getToken: getTokenOpt,
    setToken,
  } = opts;

  // Instantiate axios client.
  const clientOptions = {
    baseURL: host,
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    },
  };
  const axiosClient = axios.create(clientOptions);

  // Create oAuth & request helpers.
  const oAuthOpts = {
    host,
    clientId,
    getToken: getTokenOpt,
    setToken,
  };
  const {
    authorize, setHost, getToken,
  } = oauth(axiosClient, oAuthOpts);
  const {
    request, deleteEntity, fetchEntity, sendEntity,
  } = farmRequest(axiosClient);

  const farm = {
    authorize,
    setHost,
    getToken,
    request,
    info() {
      return request('/api');
    },
    schema: {
      fetch(entity, bundle) {
        if (!entity) {
          const schemata = map(() => ({}), entities);
          return request('/api/')
            .then(res => Promise.all(Object.keys(res.data.links)
              .filter(type => entityNames.some(name => type.startsWith(`${name}--`)))
              .map((type) => {
                const [entName, b] = type.split('--');
                return request(`/api/${entName}/${b}/resource/schema`)
                  .then(({ data: schema }) => { schemata[entName][b] = schema; });
              })))
            .then(() => schemata);
        }
        if (!bundle) {
          return request('/api/')
            .then(res => Promise.all(Object.keys(res.data.links)
              .filter(type => type.startsWith(`${entity}--`))
              .map((type) => {
                const b = typeToBundle(entity, type);
                return request(`/api/${entity}/${b}/resource/schema`)
                  .then(({ data: schema }) => [b, schema]);
              }))
              .then(Object.fromEntries));
        }
        return request(`/api/${entity}/${bundle}/resource/schema`)
          .then(prop('data'));
      },
    },
    ...entityMethods(({ nomenclature: { name } }) => ({
      delete: deleteEntity(name),
      fetch: fetchEntity(name),
      send: sendEntity(name),
    }), entities),
  };
  return farm;
}
