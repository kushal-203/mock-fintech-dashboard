// Prompt template for the self-healing LLM call – kept separate so it can be reviewed and versioned.
function buildPrompt({ def, candidates, aria }) {
  return `You are a senior QA automation engineer repairing a broken Playwright locator.

## Broken locator
- Selector: ${def.selector}
- What it is for (intent): ${def.intent}
- Expected ARIA role: ${def.expectedRole || 'none (non-interactive display element)'}
- Why it probably broke: ${def.antiPattern}

## Current page – ARIA snapshot (truncated)
${aria.slice(0, 6000)}

## Current page – visible candidate elements (JSON)
${JSON.stringify(candidates.map(({ semantic, ...c }) => c)).slice(0, 12000)}

## Rules
1. Choose ONE element from the candidate list that matches the intent. Never invent an element.
2. Use the most resilient strategy available, in this order:
   role + accessible name  >  data-testid  >  label  >  exact visible text.
   Never return CSS selectors, ids, classes, nth-child or XPath.
3. Do not use an accessible name that contains live data (counts, amounts, dates) – prefer data-testid then.
4. The locator must match exactly one element.
5. If nothing matches the intent, answer {"locator": null, "confidence": 0, "reason": "..."}.

## Answer with JSON only
{"locator": {"strategy": "role|testid|label|text", "role": "<if role>", "name": "<if role>", "value": "<if testid/label/text>"},
 "confidence": <0..1>,
 "reason": "<one sentence>"}`;
}

module.exports = { buildPrompt };
