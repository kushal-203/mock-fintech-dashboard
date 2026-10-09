const fs = require('fs');
const path = require('path');
const { BeforeAll, AfterAll, Before, After, Status } = require('@cucumber/cucumber');
const playwright = require('playwright');
const config = require('../config/config');

const SCREENSHOT_DIR = path.resolve('results', 'screenshots');
let browser;
let server;

BeforeAll(async function () {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  if (config.startServer) {
    process.env.ENABLE_TEST_ROUTES = 'true'; // exposes POST /api/test/reset for data isolation
    const { start } = require('../../backend/server');
    server = await start(config.serverPort);
  }
});

AfterAll(async function () {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});

// Every scenario gets an API context: API scenarios use it directly and UI scenarios use it to
// compute expected values independently of the UI.
Before(async function () {
  this.api = await playwright.request.newContext({ baseURL: `${config.apiBaseUrl}/`, timeout: config.defaultTimeout });
  if (config.resetDataBeforeEach) {
    const res = await this.api.post('test/reset');
    if (res.status() !== 200) throw new Error(`Test data reset failed: HTTP ${res.status()}`);
  }
});

Before({ tags: '@ui' }, async function () {
  browser ||= await playwright[config.browser].launch({ headless: config.headless, executablePath: config.executablePath });
  this.context = await browser.newContext({ baseURL: config.baseUrl, viewport: { width: 1366, height: 900 } });
  this.page = await this.context.newPage();
  this.page.setDefaultTimeout(config.defaultTimeout);
});

After(async function (scenario) {
  if (this.page) {
    const failed = scenario.result.status === Status.FAILED;
    if (config.screenshotOn === 'always' || (failed && config.screenshotOn === 'failure')) {
      const name = `${failed ? 'FAILED-' : ''}${scenario.pickle.name}`.replace(/[^a-z0-9-]+/gi, '_').slice(0, 120);
      const png = await this.page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });
      this.attach(png, 'image/png');
    }
    await this.context.close();
  }
  if (this.api) await this.api.dispose();
});
