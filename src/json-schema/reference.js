import addIndex from 'ramda/src/addIndex.js';
import clone from 'ramda/src/clone.js';
import evolve from 'ramda/src/evolve.js';
import identity from 'ramda/src/identity.js';
import map from 'ramda/src/map.js';
import mapObjIndexed from 'ramda/src/mapObjIndexed.js';
import rPath from 'ramda/src/path.js';
import parseURI from './uri.js';
import { isObject, boolOrThrow, hasLogicalKeyword } from './utils.js';

/**
 * @template T
 * @param {(t: T, i: number) => T} transform
 * @param {Array.<T>} array
 * @returns {Array.<T>}
*/
const mapIndexed = addIndex(map);

/**
 * JSON Schema: A complete definition can probably be imported from a library.
 * @typedef {Object|Boolean} JsonSchema
 */

/**
 * JSON Schema Dereferenced: A JSON Schema, but w/o any $ref keywords. As such,
 * it may contain circular references that cannot be serialized.
 * @typedef {Object|Boolean} JsonSchemaDereferenced
 */

const trimPathRexEx = /^[/#\s]*|[/#\s]*$/g;
/** @type {(path: string) => String} */
const trimPath = path => path.replace(trimPathRexEx, '');

/**
 * Resolve a schema definition from a JSON pointer reference.
 * @param {JsonSchema} schema
 * @param {string} pointer - A relative URI provided as the `$ref` keyword.
 * @returns {JsonSchema}
 */
export const getDefinition = (schema, pointer) => {
  const pathSegments = trimPath(pointer).split('/');
  const subschema = rPath(pathSegments, schema);
  if (subschema === undefined) return true;
  return subschema;
};

/**
 * Resolve the `$ref` keyword in given schema to its corresponding subschema.
 * @param {JsonSchema} root - The root schema that contained the reference.
 * @param {string} ref - The URI provided as the `$ref` keyword in the root
 *  schema or one of its subschemas.
 * @param {Object} [options]
 * @param {string} [options.retrievalURI] - The URI where the schema was found.
 * @param {Object.<string, JsonSchemaDereferenced>} [options.knownReferences] -
 * An object mapping known references to their corresponding dereferenced schemas.
 * @returns {JsonSchema}
 */
export const getReference = (root, ref, options = {}) => {
  if (typeof ref !== 'string' || ref === '') {
    const submsg = ref === '' ? '[empty string]' : ref;
    throw new Error(`Invalid reference: ${submsg}`);
  }
  const { retrievalURI, knownReferences = {} } = options;
  if (ref in knownReferences) return knownReferences[ref];
  if (!isObject(root)) return boolOrThrow(root);
  // The $id keyword takes precedence according to the JSON Schema spec.
  const rootURI = root.$id || retrievalURI || null;
  const {
    scheme = '', domain = '', port = '', path = '', fragment = '',
  } = parseURI(ref);
  const baseURI = scheme + domain + port + path;
  const baseIsRoot = rootURI === baseURI || ref === fragment;
  let refRoot;
  if (baseIsRoot) refRoot = root;
  if (!baseIsRoot && baseURI in knownReferences) refRoot = knownReferences[baseURI];
  if (refRoot === undefined) return true;
  if (fragment) return getDefinition(refRoot, fragment);
  return refRoot;
};

const setInPlace = (obj, path = [], val) => {
  if (path.length < 1) return;
  const [i, ...tail] = path;
  if (!['string', 'number'].includes(typeof i)) throw new Error('Invalid path');
  if (!(i in obj)) throw new Error('Path not found');
  if (tail.length === 0) {
    obj[i] = val; // eslint-disable-line no-param-reassign
    return;
  }
  setInPlace(obj[i], tail, val);
};

/**
 * Takes a schema which may contain the $ref keyword in it or in its subschemas,
 * and returns an equivalent schema where those references have been replaced
 * with the full schema document.
 * @param {JsonSchema} root - The root schema to be dereferenced.
 * @param {Object} [options]
 * @param {string} [options.retrievalURI] - The URI where the schema was found.
 * @param {string[]} [options.ignore] - A list of schemas to ignore. They will
 * subsequently be referenced as `true`.
 * @param {Object.<string, JsonSchema>} [options.knownReferences] - An object mapping
 * known references to their corresponding schemas. They will also be dereferenced.
 * @returns {JsonSchemaDereferenced}
 */
export const dereference = (root, options = {}) => {
  const { retrievalURI, ignore = [], knownReferences = {} } = options;

  const knownRefsMap = new Map();
  /** @type {(ref: string, refSchema: JsonSchema) => void} */
  const setKnownRef = (ref, refSchema) => {
    const appliedSchema = ignore.includes(ref) ? true : refSchema;
    knownRefsMap.set(ref, appliedSchema);
  };
  Object.entries(knownReferences).forEach(([ref, refSchema]) => {
    // We could just use setKnownRef here, but this prevents unnecessary recursion;
    const schema = ignore.includes(ref) ? true : dereference(refSchema);
    knownRefsMap.set(ref, schema);
  });

  // Set ignore refs to true to start, so they don't have to be checked in every
  // call to `deref` below.
  ignore.forEach((ref) => { knownRefsMap.set(ref, true); });
  const baseURI = root.$id || retrievalURI || null;
  const _root = clone(root);

  /** @type {(schema: JsonSchema, path?: Array.<string|number>) => JsonSchemaDereferenced} */
  const deref = (schema, path = []) => {
    if (!isObject(schema)) return boolOrThrow(schema);
    let _schema = schema;
    const set = (cb) => {
      _schema = cb(_schema);
      setInPlace(_root, path, _schema);
    };
    const derefSubschema = keyword => sub => deref(sub, [...path, keyword]);
    const derefSubschemaObject = keyword => mapObjIndexed((sub, prop) =>
      deref(sub, [...path, keyword, prop]));
    const derefSubschemaArray = keyword => mapIndexed((sub, i) =>
      deref(sub, [...path, keyword, i]));
    const schemaTypes = {
      string: identity,
      number: identity,
      integer: identity,
      object: evolve({
        properties: derefSubschemaObject('properties'),
        patternProperties: derefSubschemaObject('patternProperties'),
        additionalProperties: derefSubschema('additionalProperties'),
      }),
      array: evolve({
        items: derefSubschema('items'),
        contains: derefSubschema('contains'),
        prefixItems: derefSubschemaArray('prefixItems'),
      }),
      boolean: identity,
      null: identity,
    };
    if ('type' in _schema && _schema.type in schemaTypes) {
      set(schemaTypes[_schema.type]);
    }
    if (hasLogicalKeyword(_schema)) {
      set(evolve({
        allOf: derefSubschemaArray('allOf'),
        anyOf: derefSubschemaArray('allOf'),
        oneOf: derefSubschemaArray('allOf'),
        not: derefSubschema('not'),
      }));
    }
    if ('$ref' in _schema) {
      const { $ref } = _schema;
      // Anything beginning with # or /, the followed only by # or /.
      const rootHashRE = /^[/#]+[/#]?$/;
      const refIsRoot = rootHashRE.test($ref) || $ref === baseURI;
      const refKey = refIsRoot ? baseURI : $ref;
      if (knownRefsMap.has(refKey)) {
        set(() => knownRefsMap.get(refKey));
      } else if (refIsRoot) {
        set(() => _root);
        setKnownRef(baseURI, _root);
      } else {
        const opts = {
          knownReferences: Object.fromEntries(knownRefsMap),
          retrievalURI,
        };
        set(() => getReference(_root, $ref, opts));
        set(sub => deref(sub, path));
        setKnownRef($ref, _schema);
      }
    }
    if (isObject(_schema) && '$id' in _schema) setKnownRef(_schema.$id, _schema);
    return _schema;
  };
  return deref(_root);
};
