// Test configuration. Every URL and setting comes from tests/config/env/<TEST_ENV>.env
// (default: local) or from real environment variables – nothing is hard-coded in tests.
const path = require('path');
const dotenv = require('dotenv');

const envName = process.env.TEST_ENV || 'local';
dotenv.config({ quiet: true, path: path.resolve(__dirname, 'env', `${envName}.env`) });

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required test setting "${name}" (TEST_ENV=${envName})`);
  return value.replace(/\/+$/, '');
}

module.exports = {
  envName,
  baseUrl: required('BASE_URL'),
  apiBaseUrl: required('API_BASE_URL'),
  startServer: process.env.START_SERVER === 'true',
  serverPort: Number(process.env.SERVER_PORT || 4100),
  resetDataBeforeEach: process.env.RESET_DATA_BEFORE_EACH === 'true',
  headless: process.env.HEADLESS !== 'false',
  browser: process.env.BROWSER || 'chromium',
  executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined, // optional pre-installed browser
  defaultTimeout: Number(process.env.DEFAULT_TIMEOUT_MS || 10000),
  screenshotOn: process.env.SCREENSHOT_ON || 'failure', // always | failure | never
};
