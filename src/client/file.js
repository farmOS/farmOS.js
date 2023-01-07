import compose from 'ramda/src/compose';
import concat from 'ramda/src/concat';
import curryN from 'ramda/src/curryN';
import mergeDeepWithKey from 'ramda/src/mergeDeepWithKey';
import path from 'ramda/src/path';
import pick from 'ramda/src/pick';
import reduce from 'ramda/src/reduce';
import { parseTypeFromFields } from '../types';

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
// Update the fields on an entity that had files related to it on those fields.
// The responses are from separate requests to send the files, with a special
// file entity's id and type contained in the response data. The updated entity
// is sent in a subsequent request only after all files are sent.
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
const toRequestConfig = curryN(2, (url, { data = null, filename = 'untitled' } = {}) => {
  if (!data) return Promise.resolve(null);
  const headers = {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `file; filename="${filename}"`,
  };
  return {
    data, headers, method: 'POST', url,
  };
});

export default function sendFiles(request, hostEntity, files = {}) {
  const { entity, bundle } = parseTypeFromFields(hostEntity);
  const fileRequests = Object.entries(files).map(([field, attributes]) => {
    const url = `/api/${entity}/${bundle}/${field}`;
    const sendFile = compose(request, toRequestConfig(url));
    const promise = Array.isArray(attributes)
      ? Promise.all(attributes.map(sendFile))
      : sendFile(attributes);
    return promise.then(response => [field, response]);
  });

  return Promise.all(fileRequests).then(updateFileField(hostEntity));
}
