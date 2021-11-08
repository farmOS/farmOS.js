import chai from 'chai';
import { readFileSync } from 'fs';
import {
  getDefinition, getReference, dereference, getProperties, getProperty, getPath,
  listProperties, getDefault,
} from '../../src/json-schema/index.js';

const { expect } = chai;
const json = readFileSync('test/json-schema/log--activity.json');
const activitySchema = JSON.parse(json);
const derefOptions = {
  ignore: ['https://jsonapi.org/schema#/definitions/resource'],
};

describe('jsonSchema', () => {
  describe('#getDefinition', () => {
    it('resolves a schema from a definition', () => {
      const attrs = getDefinition(activitySchema, '#/definitions/attributes');
      expect(attrs).to.have.property('description', 'Entity attributes');
    });
  });
  describe('#getReference', () => {
    it('resolves a reference from a pointer fragment', () => {
      const attrs = getReference(activitySchema, '#/definitions/attributes');
      expect(attrs).to.have.property('description', 'Entity attributes');
    });
    it('resolves a reference that matches a knownReferences option', () => {
      const knownReferences = { '#/definitions/attributes': { foo: 42 } };
      const attrs = getReference(activitySchema, '#/definitions/attributes', { knownReferences });
      expect(attrs).to.have.property('foo', 42);
    });
    it('resolves a reference that matches the base URI of a knownReferences option', () => {
      const base = 'https://example.com/api/';
      const ref = `${base}#/$defs/attributes`;
      const refSchema = { $defs: { attributes: { foo: 42 } } };
      const knownReferences = { [base]: refSchema };
      const attrs = getReference(activitySchema, ref, { knownReferences });
      expect(attrs).to.have.property('foo', 42);
    });
  });
  describe('#dereference', () => {
    it('doesn\'t blow the call stack w/ an infinite loop', () => {
      const recursiveSchema = {
        $id: 'https://example.com/api/person',
        type: 'object',
        properties: {
          name: { $ref: '#/$defs/name' },
          children: { $ref: '#/$defs/people' },
          team: { $ref: '#/$defs/team' },
        },
        $defs: {
          name: { type: 'string' },
          people: {
            type: 'array',
            items: { $ref: '#' },
          },
          team: {
            type: 'object',
            properties: {
              name: { $ref: '#/$defs/name' },
              members: { $ref: '#/$defs/people' },
            },
          },
        },
      };
      const dereffedSchema = dereference(recursiveSchema);
      const childSchema = dereffedSchema.properties.children.items;
      expect(childSchema.$id).to.equal('https://example.com/api/person');
      const grandchildSchema = childSchema.properties.children.items;
      expect(grandchildSchema.$id).to.equal('https://example.com/api/person');
    });
    it('works on the JSON Schema for a farmOS activity log', () => {
      const dereffedSchema = dereference(activitySchema, derefOptions);
      expect(dereffedSchema).to.have.nested.property('allOf.length', 2);
      expect(dereffedSchema.allOf[1]).to.equal(true);
      expect(dereffedSchema.allOf[0]).to.have.property('type', 'object');
      const { attributes } = dereffedSchema.allOf[0].properties;
      expect(attributes).to.have.property('type', 'object');
      expect(attributes).to.have.nested.property('properties.status.type', 'string');
    });
  });
  describe('#getProperties', () => {
    it('works on a simple schema', () => {
      const schema = { properties: { foo: { type: 'string' } } };
      const properties = getProperties(schema);
      expect(properties).to.have.nested.property('foo.type', 'string');
    });
    it('works on a schema with allOf keyword', () => {
      const schema = {
        allOf: [
          { properties: { foo: { type: 'string' } } },
          { properties: { foo: { maxLength: 255 }, bar: { type: 'string' } } },
        ],
      };
      const properties = getProperties(schema);
      expect(properties).to.have.nested.property('foo.allOf[0].maxLength', 255);
      expect(properties).to.have.nested.property('bar.type', 'string');
    });
    it('works on a schema with not keyword', () => {
      const schema = {
        not: { properties: { foo: { maxLength: 255 }, bar: { type: 'string' } } },
      };
      const properties = getProperties(schema);
      expect(properties).to.have.nested.property('foo.not.maxLength', 255);
      expect(properties).to.have.nested.property('bar.not.type', 'string');
    });
  });
  describe('#getProperty', () => {
    it('works on a schema with allOf keyword', () => {
      const schema = {
        allOf: [
          { properties: { foo: { type: 'string' } } },
          { properties: { foo: { maxLength: 255 }, bar: { type: 'string' } } },
        ],
      };
      const foo = getProperty(schema, 'foo');
      expect(foo).to.have.nested.property('allOf[0].maxLength', 255);
      const bar = getProperty(schema, 'bar');
      expect(bar).to.have.property('type', 'string');
    });
  });
  describe('#getPath', () => {
    const schema = {
      type: 'object',
      properties: {
        foo: {
          properties: { bar: { maxLength: 255 }, baz: { type: 'string' } },
          type: 'object',
        },
      },
    };
    it('gets path with depth of 1 (arg1: string)', () => {
      const foo = getPath(schema, 'foo');
      expect(foo).to.have.property('type', 'object');
      expect(foo).to.have.nested.property('properties.bar.maxLength', 255);
    });
    it('gets path with depth of 2 (arg1: string, arg2: string)', () => {
      const bar = getPath(schema, 'foo', 'bar');
      expect(bar).to.have.nested.property('maxLength', 255);
      const baz = getPath(schema, 'foo', 'baz');
      expect(baz).to.have.nested.property('type', 'string');
    });
    it('gets path with depth of 1 (arg1: string[])', () => {
      const foo = getPath(schema, ['foo']);
      expect(foo).to.have.property('type', 'object');
      expect(foo).to.have.nested.property('properties.bar.maxLength', 255);
    });
    it('gets path with depth of 2 (arg1: string[])', () => {
      const bar = getPath(schema, ['foo', 'bar']);
      expect(bar).to.have.nested.property('maxLength', 255);
      const baz = getPath(schema, ['foo', 'baz']);
      expect(baz).to.have.nested.property('type', 'string');
    });
    it('works on the JSON Schema for a farmOS activity log', () => {
      const activity = dereference(activitySchema, derefOptions);
      const attributes = getPath(activity, 'attributes');
      expect(attributes).to.be.an('object')
        .that.has.a.nested.property('properties.status');
      const status = getPath(activity, ['attributes', 'status']);
      expect(status).to.be.an('object').that.has.a.property('type', 'string');
    });
  });
  describe('#listProperties', () => {
    const schema = {
      type: 'object',
      properties: {
        foo: {
          properties: {
            bar: { maxLength: 255 },
            baz: {
              type: 'object',
              properties: { qux: { type: 'string' } },
            },
          },
          type: 'object',
        },
      },
    };
    it('lists properties at depth of 0', () => {
      const list = listProperties(schema);
      expect(list).to.have.lengthOf(1);
      expect(list).to.include('foo');
    });
    it('lists properties at depth of 1', () => {
      const foo = listProperties(schema, 'foo');
      expect(foo).to.have.lengthOf(2);
      expect(foo).to.include('bar');
      expect(foo).to.include('baz');
    });
    it('lists properties at depth of 2', () => {
      const bar = listProperties(schema, ['foo', 'bar']);
      expect(bar).to.have.lengthOf(0);
      const baz = listProperties(schema, 'foo', 'baz');
      expect(baz).to.have.lengthOf(1);
      expect(baz).to.include('qux');
    });
    it('works on the JSON Schema for a farmOS activity log', () => {
      const activity = dereference(activitySchema, derefOptions);
      const attributes = listProperties(activity, 'attributes');
      expect(attributes).to.be.an('array').that.includes('notes');
      const notes = listProperties(activity, ['attributes', 'notes']);
      expect(notes).to.be.an('array').that.includes('format');
    });
  });
  describe('#getDefault', () => {
    it('use the "default" keyword to get the default for a nested property', () => {
      const schema = {
        type: 'object',
        properties: {
          foo: {
            type: 'object',
            properties: {
              bar: {
                type: 'string',
                default: 'baz',
              },
            },
          },
        },
      };
      const barDefault = getDefault(schema, ['foo', 'bar']);
      expect(barDefault).to.equal('baz');
    });
    it('uses the byType option', () => {
      const schema = {
        type: 'object',
        properties: {
          foo: {
            type: 'string',
          },
        },
      };
      const options = { byType: { string: () => 'bar' } };
      const fooDefault = getDefault(schema, 'foo', options);
      expect(fooDefault).to.equal('bar');
    });
    it('uses the byFormat option', () => {
      const schema = {
        type: 'object',
        properties: {
          foo: {
            type: 'string',
            format: 'date-time',
          },
        },
      };
      const iso = '2021-10-31T01:33:33.478Z';
      const options = { byFormat: { 'date-time': () => iso } };
      const fooDefault = getDefault(schema, 'foo', options);
      expect(fooDefault).to.equal(iso);
    });
    it('gets the default "name" for a farmOS activity log', () => {
      const dereffedSchema = dereference(activitySchema);
      const nameDefault = getDefault(dereffedSchema, ['attributes', 'name']);
      expect(nameDefault).to.equal('');
    });
    it('gets the default for "asset" in a farmOS activity log', () => {
      const dereffedSchema = dereference(activitySchema);
      const path = ['relationships', 'asset', 'data'];
      const options = { byType: { array: () => [] } };
      const assetDefault = getDefault(dereffedSchema, path, options);
      expect(assetDefault).to.deep.equal([]);
    });
  });
});
