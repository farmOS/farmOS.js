const { expect } = require('chai');
const { v4: uuidv4 } = require('uuid');
const { farm, session } = require('./client');

describe('log', () => {
  it('creates a log with client-generated id, revises it and fetches it.', () => {
    const id = uuidv4();
    return session()
      .then(() => {
        const log = {
          id,
          type: 'log--activity',
          attributes: {
            name: 'Node Test',
          },
        };
        return farm.log.send(log);
      })
      .then((response) => {
        expect(response).to.have.nested.property('data.id', id);
        const log = {
          id,
          type: 'log--activity',
          attributes: {
            name: 'Node Test Revised',
            status: 'done',
          },
        };
        return farm.log.send(log);
      })
      .then(() => {
        const filter = {
          $or: [
            { type: 'activity', status: 'done' },
            { type: 'observation', status: 'pending' },
          ],
        };
        return farm.log.get({ filter });
      })
      .then((responses) => {
        expect(responses).to.have.lengthOf(2);
        const log = responses
          .flatMap(r => r.data)
          .find(l => l.id === id);
        expect(log).to.have.nested.property('attributes.name', 'Node Test Revised');
      });
  });
});
