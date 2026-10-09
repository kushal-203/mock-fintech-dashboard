// Cucumber profiles – run with: npx cucumber-js --profile <name>
const common = {
  require: ['tests/support/**/*.js', 'tests/step-definitions/**/*.js'],
  format: ['progress-bar', 'summary'],
  formatOptions: { snippetInterface: 'async-await' },
};
const report = (name) => [`html:results/${name}/cucumber-report.html`, `json:results/${name}/cucumber-report.json`];

module.exports = {
  default: { ...common, paths: ['tests/features/**/*.feature'], tags: 'not @broken-locators' },
  ui: { ...common, paths: ['tests/features/ui/**/*.feature'], format: [...common.format, ...report('ui')] },
  api: { ...common, paths: ['tests/features/api/**/*.feature'], format: [...common.format, ...report('api')] },
  // Intentionally broken locators for the self-healing exercise – EXPECTED TO FAIL.
  broken: { ...common, paths: ['tests/features/self-healing/**/*.feature'], format: [...common.format, ...report('broken')] },
};
