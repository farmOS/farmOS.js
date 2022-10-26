require('dotenv').config();

// These are the parameters required to connect to the local server used by
// tests and scripts in both the development and CI environments.
module.exports = {
  host: 'http://localhost',
  clientId: 'fieldkit',
  username: process.env.TEST_USERNAME || 'admin',
  password: process.env.TEST_USERNAME || 'admin',
};
