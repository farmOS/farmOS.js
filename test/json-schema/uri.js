const chai = require('chai');
const { parseURI } = require('../../dist/cjs/json-schema');

const { expect } = chai;

describe('uri', () => {
  const results = {
    r0: parseURI('/tasks/edit'),
    r1: parseURI('#/tasks/edit'),
    r2: parseURI('#tasks/edit'),
    r3: parseURI('develop.farmos.app/tasks/edit#foo'),
    r4: parseURI('http://develop.farmos.app/#tasks/edit'),
    r5: parseURI('https://develop.farmos.app:80/tasks/edit?foo=42#bar'),
    r6: parseURI('https://localhost:80/tasks/edit?foo=42#bar'),
  };
  it('parses a relative URI: /tasks/edit', () => {
    expect(results).to.have.deep.property('r0', {
      match: '/tasks/edit',
      scheme: undefined,
      domain: undefined,
      port: undefined,
      path: '/tasks/edit',
      query: undefined,
      fragment: undefined,
    });
  });
  it('parses a pointer fragment: #/tasks/edit', () => {
    expect(results).to.have.deep.property('r1', {
      match: '#/tasks/edit',
      scheme: undefined,
      domain: undefined,
      port: undefined,
      path: undefined,
      query: undefined,
      fragment: '#/tasks/edit',
    });
  });
  it('parses a pointer fragment w/o leading slash: #tasks/edit', () => {
    expect(results).to.have.deep.property('r2', {
      match: '#tasks/edit',
      scheme: undefined,
      domain: undefined,
      port: undefined,
      path: undefined,
      query: undefined,
      fragment: '#tasks/edit',
    });
  });
  it('parses a URI w/ domain but no scheme : develop.farmos.app/tasks/edit#foo', () => {
    expect(results).to.have.deep.property('r3', {
      match: 'develop.farmos.app/tasks/edit#foo',
      scheme: undefined,
      domain: 'develop.farmos.app',
      port: undefined,
      path: '/tasks/edit',
      query: undefined,
      fragment: '#foo',
    });
  });
  it('parses an absolute root URI w/ pointer fragment: http://develop.farmos.app/#tasks/edit', () => {
    expect(results).to.have.deep.property('r4', {
      match: 'http://develop.farmos.app/#tasks/edit',
      scheme: 'http://',
      domain: 'develop.farmos.app',
      port: undefined,
      path: '/',
      query: undefined,
      fragment: '#tasks/edit',
    });
  });
  it('parses the kitchen sink: https://develop.farmos.app:80/tasks/edit?foo=42#bar', () => {
    expect(results).to.have.deep.property('r5', {
      match: 'https://develop.farmos.app:80/tasks/edit?foo=42#bar',
      scheme: 'https://',
      domain: 'develop.farmos.app',
      port: ':80',
      path: '/tasks/edit',
      query: '?foo=42',
      fragment: '#bar',
    });
  });
  it('works for localhost too: https://localhost:80/tasks/edit?foo=42#bar', () => {
    expect(results).to.have.deep.property('r6', {
      match: 'https://localhost:80/tasks/edit?foo=42#bar',
      scheme: 'https://',
      domain: 'localhost',
      port: ':80',
      path: '/tasks/edit',
      query: '?foo=42',
      fragment: '#bar',
    });
  });
});
