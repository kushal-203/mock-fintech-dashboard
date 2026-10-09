// Prints a per-scenario PASS/FAIL summary from the Cucumber JSON reports in results/.
// Usage: node scripts/summarise-results.js [results/ui/cucumber-report.json ...]
const fs = require('fs');

const files = process.argv.slice(2).length ? process.argv.slice(2) : [
  'results/api/cucumber-report.json', 'results/ui/cucumber-report.json', 'results/broken/cucumber-report.json',
].filter((f) => fs.existsSync(f));

for (const file of files) {
  const features = JSON.parse(fs.readFileSync(file, 'utf8'));
  let pass = 0; let fail = 0;
  console.log(`\n=== ${file} ===`);
  for (const f of features) {
    console.log(`\nFeature: ${f.name}`);
    for (const s of f.elements.filter((e) => e.type === 'scenario')) {
      const failedStep = s.steps.find((st) => st.result.status === 'failed');
      const ok = s.steps.every((st) => ['passed', 'skipped'].includes(st.result.status)) && !failedStep;
      ok ? pass++ : fail++;
      console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${s.name}`);
      if (failedStep) console.log(`        ↳ ${failedStep.keyword.trim()} ${failedStep.name}\n          ${String(failedStep.result.error_message || '').split('\n')[0]}`);
    }
  }
  console.log(`\nTotal: ${pass + fail} scenarios, ${pass} passed, ${fail} failed`);
}
