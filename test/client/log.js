import chai from 'chai';
import { v4 as uuidv4 } from 'uuid';
import { reportError } from '../report.js';
import { farm, session } from './client.js';

const { expect } = chai;

describe('log', function () {
  this.timeout(10000);
  it('creates a log with client-generated id, revises, fetches and deletes it.', () => {
    const id = uuidv4();
    return session()
      .then(() => {
        const log = {
          id,
          type: 'log--activity',
          attributes: {
            name: 'Node Test',
            timestamp: '2021-04-26T09:18:33Z',
          },
        };
        return farm.log.send('activity', log);
      })
      .then((response) => {
        expect(response).to.have.nested.property('data.data.id', id);
        const log = {
          id,
          type: 'log--activity',
          attributes: {
            name: 'Node Test Revised',
            status: 'done',
          },
        };
        return farm.log.send('activity', log);
      })
      .then(() => {
        const filter = { status: 'done', name: 'Node Test Revised' };
        return farm.log.fetch('activity', { filter });
      })
      .then((response) => {
        const log = response.data.data.find(l => l.id === id);
        expect(log).to.have.nested.property('attributes.name', 'Node Test Revised');
        return farm.log.delete('activity', id);
      })
      .then(() => farm.log.fetch('activity', { filter: { id } }))
      .then((response) => {
        expect(response.data.data).to.have.lengthOf(0);
      })
      .catch(reportError);
  });
});
