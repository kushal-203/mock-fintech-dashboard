class BasePage {
  /** @param {import('playwright').Page} page */
  constructor(page) {
    this.page = page;
  }

  async open(path = '/') {
    await this.page.goto(path);
    // The app sets <body data-ready="true"> once every widget has loaded its data.
    await this.page.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
  }

  heading(name) {
    return this.page.getByRole('heading', { name, exact: true });
  }
}

module.exports = { BasePage };
