class TransferForm {
  constructor(page) {
    this.page = page;
    this.form = page.getByRole('form', { name: 'New transfer' });
    this.from = this.form.getByLabel('From account');
    this.to = this.form.getByLabel('To account');
    this.amount = this.form.getByLabel('Amount (USD)');
    this.description = this.form.getByLabel('Description');
    this.submitButton = this.form.getByRole('button', { name: 'Send transfer' });
    this.feedback = page.getByTestId('transfer-feedback');
  }

  async fill({ from, to, amount, description }) {
    if (from) await this.from.selectOption(from);
    if (to) await this.to.selectOption(to);
    if (amount !== undefined) await this.amount.fill(String(amount));
    if (description !== undefined) await this.description.fill(description);
  }

  async submit() {
    const response = this.page.waitForResponse((r) => r.url().includes('/api/transfers'));
    await this.submitButton.click();
    return response;
  }
}

module.exports = { TransferForm };
