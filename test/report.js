import fs from 'fs';

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

export default function report(data, filename = 'report.json') {
  fs.writeFileSync(filename, safeStringify(data));
}

export function reportError(error, options = {}) {
  const { filename = 'error.json', message } = options;
  if (error instanceof Error) {
    const props = ['name', ...Object.getOwnPropertyNames(error)];
    const errorObject = props.reduce((o, p) => ({ ...o, [p]: error[p] }), {});
    report(errorObject, filename);
    throw error;
  } else {
    report(error, filename);
    const msg = message || `Error encountered. See ${filename} for more details.`;
    throw new Error(msg, { cause: error });
  }
}
