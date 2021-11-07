import compose from 'ramda/src/compose.js';
import mapObjIndexed from 'ramda/src/mapObjIndexed.js';
import map from 'ramda/src/map.js';
import reduce from 'ramda/src/reduce.js';
import connect from './index.js';
import entities, { entityMethods } from '../entities.js';
import {
  generateFilterTransforms, transformD9Schema, transformLocalEntity,
  transformFetchResponse, transformSendResponse,
} from './transformations.js';

function parseBundles(filter, validTypes) {
  const bundles = [];
  // The filter must either be an object (logical $and) or an array (logical $or).
  if (Array.isArray(filter) || Array.isArray(filter.$or)) {
    (Array.isArray(filter) ? filter : filter.$or).forEach((f) => {
      parseBundles(f).forEach(({ name, filter: bundleFilter }) => {
        const i = bundles.findIndex(b => b.name === name);
        if (i > -1) {
          // Concat on an empty array to flatten either bundle or both.
          bundles[i].filter = [].concat(bundles[i].filter, bundleFilter);
        } else {
          bundles.push({ name, filter: bundleFilter });
        }
      });
    });
    return bundles;
  }
  if (typeof filter !== 'object') throw new Error(`Invalid filter: ${filter}`);
  const { type, ...rest } = typeof filter.$and === 'object' ? filter.$and : filter;
  if (typeof type === 'string') {
    if (!validTypes.includes(type)) throw new Error(`Invalid type filter: ${type}`);
    bundles.push({ name: type, filter: rest });
  }
  if (Array.isArray(type)) {
    type.forEach((t) => {
      if (!validTypes.includes(t)) throw new Error(`Invalid type filter: ${t}`);
      bundles.push({ name: t, filter: rest });
    });
  }
  if ([undefined, null].includes(type)) {
    validTypes.forEach((t) => {
      bundles.push({ name: t, filter: rest });
    });
  }
  return bundles;
}

const aggregateBundles = reduce((aggregate, result) => {
  const { data, fulfilled, rejected } = aggregate;
  const { reason, value, status } = result;
  if (status === 'fulfilled') {
    return {
      data: data.concat(value.data.data),
      fulfilled: fulfilled.concat(value),
      rejected,
    };
  }
  return {
    data,
    fulfilled,
    rejected: rejected.concat(reason),
  };
}, { data: [], fulfilled: [], rejected: [] });

export default function adapter(model, opts) {
  const { host, ...rest } = opts;
  const connection = connect(host, rest);
  const initSchemata = model.schema.get();
  let filterTransforms = generateFilterTransforms(initSchemata);
  model.schema.on('set', (schemata) => {
    filterTransforms = generateFilterTransforms(schemata);
  });

  return {
    ...connection,
    schema: {
      fetch(entName, type) {
        return connection.schema.fetch(entName, type)
          .then((schemata) => {
            if (!entName) {
              return mapObjIndexed(
                (entitySchemata, entityName) => map(
                  transformD9Schema(entityName),
                  entitySchemata,
                ),
                schemata,
              );
            }
            if (!type) {
              return map(transformD9Schema(entName), schemata);
            }
            return transformD9Schema(entName)(schemata);
          });
      },
    },
    ...entityMethods(({ nomenclature: { name, shortName } }) => ({
      ...connection[shortName],
      fetch: ({ filter }) => {
        const validTypes = Object.keys(model.schema.get(name));
        const bundles = parseBundles(filter, validTypes);
        const bundleRequests = bundles.map(({ name: bundle, filter: bundleFilter }) =>
          connection[shortName].fetch(bundle, { filter: bundleFilter, filterTransforms }));
        const handleBundleResponse = compose(
          transformFetchResponse(name),
          aggregateBundles,
        );
        return Promise.allSettled(bundleRequests)
          .then(handleBundleResponse);
      },
      send: data => connection[shortName].send(
        data.type,
        transformLocalEntity(name, data),
      ).then(transformSendResponse(name)),
    }), entities),
  };
}
