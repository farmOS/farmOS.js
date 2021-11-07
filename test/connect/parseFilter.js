import chai from 'chai';
import string from 'chai-string';
import parseFilter from '../../src/connect/parseFilter.js';

chai.use(string);
const { expect } = chai;

describe('parseFilter', () => {
  it('parses a simple query w/ id only', () => {
    const filter = {
      id: '0c17b744-1ce8-4d42-af14-0ab90d6581d3',
    };
    const params = parseFilter(filter);
    expect(params).to.equalIgnoreSpaces(`
      filter[id-0-filter][condition][path]=id
      &filter[id-0-filter][condition][operator]=%3D
      &filter[id-0-filter][condition][value]=0c17b744-1ce8-4d42-af14-0ab90d6581d3
    `);
  });
  it('parses a more complex query', () => {
    const filter = {
      $or: [
        { status: 'done', count: { $gt: 35, $lt: 43 } },
        { id: '1234' },
      ],
    };
    const params = parseFilter(filter);
    expect(params).to.equalIgnoreSpaces(`
      filter%5Bgroup-1%5D%5Bgroup%5D%5Bconjunction%5D=OR
      &filter%5Bstatus-0-filter%5D%5Bcondition%5D%5Bpath%5D=status
      &filter%5Bstatus-0-filter%5D%5Bcondition%5D%5Boperator%5D=%3D
      &filter%5Bstatus-0-filter%5D%5Bcondition%5D%5Bvalue%5D=done
      &filter%5Bstatus-0-filter%5D%5Bcondition%5D%5BmemberOf%5D=group-1
      &filter%5Bcount-0-filter%5D%5Bcondition%5D%5Bpath%5D=count
      &filter%5Bcount-0-filter%5D%5Bcondition%5D%5Boperator%5D=%3E
      &filter%5Bcount-0-filter%5D%5Bcondition%5D%5Bvalue%5D=35
      &filter%5Bcount-1-filter%5D%5Bcondition%5D%5Bpath%5D=count
      &filter%5Bcount-1-filter%5D%5Bcondition%5D%5Boperator%5D=%3C
      &filter%5Bcount-1-filter%5D%5Bcondition%5D%5Bvalue%5D=43
      &filter%5Bid-0-filter%5D%5Bcondition%5D%5Bpath%5D=id
      &filter%5Bid-0-filter%5D%5Bcondition%5D%5Boperator%5D=%3D
      &filter%5Bid-0-filter%5D%5Bcondition%5D%5Bvalue%5D=1234
      &filter%5Bid-0-filter%5D%5Bcondition%5D%5BmemberOf%5D=group-1
  `);
  });
  it('parses a filter with dot notation', () => {
    const filter = { 'owner.id': 1 };
    const params = parseFilter(filter);
    expect(params).to.equalIgnoreSpaces(`
      filter[owner.id-0-filter][condition][path]=owner.id
      &filter[owner.id-0-filter][condition][operator]=%3D
      &filter[owner.id-0-filter][condition][value]=1
    `);
  });
});
