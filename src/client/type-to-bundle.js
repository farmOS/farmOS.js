import replace from 'ramda/src/replace.js';

export default (entity, type) =>
  replace(`${entity}--`, '', type);
