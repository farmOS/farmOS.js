const { replace } = require('ramda');

const typeToBundle = (entity, type) => replace(`${entity}--`, '', type);

module.exports = { typeToBundle };
