const chai = require('chai');
const parseFilter = require('../src/connect/parseFilter');

const { expect } = chai;
chai.use(require('chai-string'));

const formatParams = r => Object.entries(r)
  .map(([bundle, params]) => `${bundle.toUpperCase()}\n${params.split('&').join('\n&')}`)
  .join('\n\n');

describe('parseFilter', () => {
  it('parses a simple query w/ type and id only', () => {
    const filter = {
      type: 'activity',
      id: '0c17b744-1ce8-4d42-af14-0ab90d6581d3',
    };
    const params = parseFilter(filter);
    expect(params).to.eql({
      activity: 'filter[id-filter][condition][path]=id&filter[id-filter][condition][operator]=%3D&filter[id-filter][condition][value]=0c17b744-1ce8-4d42-af14-0ab90d6581d3',
    });
    const formatted = formatParams(params);
    expect(formatted).to.equalIgnoreSpaces(`
      ACTIVITY
      filter[id-filter][condition][path]=id
      &filter[id-filter][condition][operator]=%3D
      &filter[id-filter][condition][value]=0c17b744-1ce8-4d42-af14-0ab90d6581d3
    `);
  });
  it('parses a more complex query', () => {
    const filter = {
      $or: [
        { type: 'activity' },
        { type: 'observation', status: 'done', count: { $gt: 35, $lt: 43 } },
        { status: 'pending' },
        { id: '1234' },
      ],
    };
    const params = parseFilter(filter);
    expect(params).to.eql({
      activity: '',
      observation: 'filter%5Bstatus-filter%5D%5Bcondition%5D%5Bpath%5D=status&filter%5Bstatus-filter%5D%5Bcondition%5D%5Boperator%5D=%3D&filter%5Bstatus-filter%5D%5Bcondition%5D%5Bvalue%5D=done',
      undefined: 'filter%5Bid-filter%5D%5Bcondition%5D%5Bpath%5D=id&filter%5Bid-filter%5D%5Bcondition%5D%5Boperator%5D=%3D&filter%5Bid-filter%5D%5Bcondition%5D%5Bvalue%5D=1234&filter%5Bstatus-filter%5D%5Bcondition%5D%5Bpath%5D=status&filter%5Bstatus-filter%5D%5Bcondition%5D%5Boperator%5D=%3D&filter%5Bstatus-filter%5D%5Bcondition%5D%5Bvalue%5D=pending&filter%5Bcount-0-filter%5D%5Bcondition%5D%5Bpath%5D=count&filter%5Bcount-0-filter%5D%5Bcondition%5D%5Boperator%5D=%3E&filter%5Bcount-0-filter%5D%5Bcondition%5D%5Bvalue%5D=35&filter%5Bcount-1-filter%5D%5Bcondition%5D%5Bpath%5D=count&filter%5Bcount-1-filter%5D%5Bcondition%5D%5Boperator%5D=%3C&filter%5Bcount-1-filter%5D%5Bcondition%5D%5Bvalue%5D=43',
    });
    const formatted = formatParams(params);
    expect(formatted).to.equalIgnoreSpaces(`
      ACTIVITY

      OBSERVATION
      filter%5Bstatus-filter%5D%5Bcondition%5D%5Bpath%5D=status
      &filter%5Bstatus-filter%5D%5Bcondition%5D%5Boperator%5D=%3D
      &filter%5Bstatus-filter%5D%5Bcondition%5D%5Bvalue%5D=done
      
      UNDEFINED
      filter%5Bid-filter%5D%5Bcondition%5D%5Bpath%5D=id
      &filter%5Bid-filter%5D%5Bcondition%5D%5Boperator%5D=%3D
      &filter%5Bid-filter%5D%5Bcondition%5D%5Bvalue%5D=1234
      &filter%5Bstatus-filter%5D%5Bcondition%5D%5Bpath%5D=status
      &filter%5Bstatus-filter%5D%5Bcondition%5D%5Boperator%5D=%3D
      &filter%5Bstatus-filter%5D%5Bcondition%5D%5Bvalue%5D=pending
      &filter%5Bcount-0-filter%5D%5Bcondition%5D%5Bpath%5D=count
      &filter%5Bcount-0-filter%5D%5Bcondition%5D%5Boperator%5D=%3E
      &filter%5Bcount-0-filter%5D%5Bcondition%5D%5Bvalue%5D=35
      &filter%5Bcount-1-filter%5D%5Bcondition%5D%5Bpath%5D=count
      &filter%5Bcount-1-filter%5D%5Bcondition%5D%5Boperator%5D=%3C
      &filter%5Bcount-1-filter%5D%5Bcondition%5D%5Bvalue%5D=43
    `);
  });
});
