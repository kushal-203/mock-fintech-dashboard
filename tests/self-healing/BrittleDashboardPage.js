// ⚠️  INTENTIONALLY BROKEN – self-healing exercise. Do NOT fix these by hand.
// Each entry is the kind of locator that breaks when markup changes, plus the metadata the healer
// needs: what the element is FOR (intent), the ARIA role it should have, and how to prove that a
// replacement is the right element (validate).

const BROKEN_LOCATORS = {
  applyFiltersButton: {
    selector: '#apply-btn',
    antiPattern: 'Hard-coded id that the markup never had (the button is identified by its text)',
    intent: 'Button that applies the transaction filters',
    expectedRole: 'button',
    validate: 'click-reloads-transactions',
  },
  statusFilter: {
    selector: 'xpath=/html/body/div[1]/main/section[3]/form/label[2]/select',
    antiPattern: 'Absolute XPath tied to an old layout (wrapper <div>, <label> nesting) that has since changed',
    intent: 'Dropdown that filters transactions by status',
    expectedRole: 'combobox',
    validate: 'select-keeps-value',
  },
  resultSummary: {
    selector: '.results-summary',
    antiPattern: 'Styling class name that was renamed during a CSS refactor',
    intent: 'Result count text showing how many transactions match the filters',
    expectedRole: null,
    validate: 'text-is-result-count',
  },
  trendChart: {
    selector: 'canvas#chart-0',
    antiPattern: 'Auto-generated id (Chart.js-style) that is not stable between builds',
    intent: 'Chart image of daily transaction volume',
    expectedRole: 'img',
    validate: 'chart-has-data',
  },
  sendTransferButton: {
    selector: 'button.btn-primary.submit-transfer',
    antiPattern: 'Chained utility classes that are not part of the markup',
    intent: 'Button that sends a new transfer',
    expectedRole: 'button',
    validate: 'click-shows-transfer-feedback',
  },
};

class BrittleDashboardPage {
  constructor(page) {
    this.page = page;
    for (const [name, def] of Object.entries(BROKEN_LOCATORS)) this[name] = page.locator(def.selector);
  }
}

module.exports = { BrittleDashboardPage, BROKEN_LOCATORS };
