const fs = require('fs');

// Based on: https://stackoverflow.com/a/11616993/1549703.
const safeStringify = (obj, space = 2) => {
  let refs = [];
  const replacer = (key, value) => {
    if (typeof value === 'object' && value !== null) { // For all recursive values
      if (refs.includes(value)) return '[Circular]'; // Circular ref
      refs.push(value); // Store the ref
    }
    return value; // Returns all values as-is unless there's a circular ref
  };
  const string = JSON.stringify(
    obj,
    replacer,
    space,
  );
  refs = null; // Enable garbage collection.
  return string;
};

function report(data, filename = 'report.json') {
  fs.writeFileSync(filename, safeStringify(data));
}

function reportError(error, options = {}) {
  const { filename = 'errors.json', message } = options;
  let errors = [];
  if (fs.existsSync(filename)) {
    const json = fs.readFileSync(filename);
    const prevErrors = JSON.parse(json);
    errors = Array.isArray(prevErrors) ? prevErrors : [prevErrors];
  }
  if (error instanceof Error) {
    const props = ['name', ...Object.getOwnPropertyNames(error)];
    const errorObject = props.reduce((o, p) => ({ ...o, [p]: error[p] }), {});
    errors.push(errorObject);
    report(errors, filename);
    throw error;
  } else {
    errors.push(error);
    report(errors, filename);
    const msg = message || `Error encountered. See ${filename} for more details.`;
    throw new Error(msg, { cause: error });
  }
}

module.exports = { report, reportError };
