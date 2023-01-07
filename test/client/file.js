const chai = require('chai');
const { v4: uuidv4 } = require('uuid');
const { reportError } = require('../report');
const { farm, session } = require('./client');

const { expect } = chai;

describe('file', function () {
  this.timeout(10000);
  const log = {
    id: uuidv4(),
    type: 'log--observation',
    attributes: { name: 'Node File Test' },
  };
  const filename = 'node_file_test.txt';
  const files = { file: [{ data: '#noop\n', filename }] };
  it('sends a file with a log', () => session()
    .then(() => farm.log.send('observation', log, { files }))
    .then((response) => {
      expect(response).to.have.nested.property('data.data.id', log.id);
      expect(response).to.have.nested.property('data.data.relationships.file.data')
        .that.has.a.lengthOf(1);
      return farm.log.delete('observation', log.id);
    })
    .then(() => farm.log.fetch('observation', { filter: { id: log.id } }))
    .then((response) => {
      expect(response.data.data).to.have.lengthOf(0);
    })
    .catch(reportError));
});
