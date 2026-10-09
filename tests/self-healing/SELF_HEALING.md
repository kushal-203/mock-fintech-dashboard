# AI Self-Healing Locators

This is the self-healing part of the project. It covers three things: the brittle locators, how AI is used to repair them, and how a repair is proven correct before anyone uses it.

| File | Purpose |
|---|---|
| [`BrittleDashboardPage.js`](BrittleDashboardPage.js) | 5 intentionally broken locators, each with *intent* metadata |
| [`../features/self-healing/brittle-locators.feature`](../features/self-healing/brittle-locators.feature) | A scenario that uses them. It **is expected to fail**: `npm run test:broken` |
| [`healer.js`](healer.js) | The helper utility: detect, then snapshot, propose, validate, and finally generate code |
| [`prompt.js`](prompt.js) | The LLM prompt template, versioned and reviewable |
| [`run-healing.js`](run-healing.js) | The POC runner: `npm run heal` |
| [`verify-validator.js`](verify-validator.js) | Negative test that wrong proposals are rejected: `npm run heal:verify` |

## 1. The broken locators

| Name | Brittle selector | Anti-pattern |
|---|---|---|
| `applyFiltersButton` | `#apply-btn` | Hard-coded id that the markup never had |
| `statusFilter` | `xpath=/html/body/div[1]/main/section[3]/form/label[2]/select` | Absolute XPath tied to an old layout |
| `resultSummary` | `.results-summary` | A styling class that was renamed |
| `trendChart` | `canvas#chart-0` | An auto-generated, unstable id |
| `sendTransferButton` | `button.btn-primary.submit-transfer` | Chained utility classes that don't exist |

Each locator also records its **intent** ("Button that applies the transaction filters"), its **expected ARIA role**, and a **behaviour check**. The fix is driven by *what the element is for*, not by whichever element looks most similar to the old selector.

## 2. How it works

```
step fails ─► DETECT ─► SNAPSHOT ─► PROPOSE (AI) ─► VALIDATE ─► REPORT + PATCH ─► human review / PR
               │           │              │               │
     0 or >1 matches   ARIA tree +   strict JSON,     unique · visible · role ·
     or bad selector   candidates    role/testid/      behaviour check ·
                                     label/text only   confidence ≥ 0.6
```

### 2.1 Detection
* A locator is broken when it matches **0** elements, matches **more than 1** element (an ambiguous match is a silent risk), or is not a valid selector. `detect()` uses `locator.count()`, so a slow page is not mistaken for a broken locator.
* **Only locator failures are healed.** Assertion failures (a wrong value, a wrong total) are product bugs and must stay red.
* A lint rule that flags `nth-child`, absolute XPath and class-only selectors in page objects would catch these in code review, before they break.

### 2.2 Context (snapshot)
`snapshot()` captures:
* the page's **ARIA snapshot** (`locator.ariaSnapshot()`), which is the same tree that `getByRole` queries;
* a compact JSON list of **visible candidates**: tag, role, accessible name, `data-testid` and id.

The snapshot is small and structured, with no raw HTML dump. That makes the prompt cheaper and leaves less room for the model to invent elements.

### 2.3 Prompt approach ([`prompt.js`](prompt.js))
1. **Choose only from the candidate list.** Inventing an element is forbidden; this guards against hallucinated selectors.
2. **Strategy order:** role + accessible name, then `data-testid`, then label, then exact text. CSS, ids, classes, `nth-child` and XPath are banned, so a fix can't be brittle again.
3. **No accessible names that contain live data**, such as counts or amounts. For those elements, use a `data-testid` instead.
4. **Strict JSON output only**: `{locator:{strategy,…}, confidence, reason}`. The model never returns code. `healer.js` builds the Playwright call from an allow-list of strategies, so nothing the model writes is executed.
5. **"No match" is an allowed answer**: `locator: null`. Temperature is 0, so the same input gives the same answer.

The model runs when `ANTHROPIC_API_KEY` is set (Claude Messages API; `HEAL_MODEL` overrides the model). Without a key, a **deterministic heuristic** proposes the fix instead. It scores token overlap between the intent and each candidate's name or test id, plus a role bonus. This keeps the POC runnable offline and in CI, and gives a baseline to compare the AI against. Both engines go through the **same validation**.

### 2.4 Validation before a fix is accepted
A proposal is accepted only if **all** of these pass on a freshly loaded page:

| Check | Why |
|---|---|
| Allowed strategy (role / testid / label / text) | Stops brittle fixes and arbitrary selectors |
| Resolves to **exactly one** element | No ambiguous matches |
| Element is **visible** | Rules out hidden duplicates |
| Has the **expected ARIA role** | The button must still be a button |
| **Behaviour check** | Proves it's the *right* element, not just *an* element (see below) |
| Confidence ≥ 0.6 | Low-confidence fixes go to a human |

Behaviour checks:
* **Apply button:** set Status = failed, click, and the request must contain `status=failed`. A *Reset* button also reloads the table, so this check is what tells them apart.
* **Status filter:** selecting `failed` sticks.
* **Result summary:** the text matches `Showing x–y of n transactions`.
* **Chart:** the element is a live Chart.js chart with data points.
* **Send button:** clicking it sends `POST /api/transfers` and the feedback area appears.

**Is the validation strong enough?** `npm run heal:verify` feeds 5 deliberately *wrong* proposals into `validate()`: the Reset button, the page indicator, the flags table, the Account dropdown, and a CSS selector. It fails if any of them is accepted. All 5 are rejected.

Nothing is written to the source automatically. The runner writes `results/self-healing/healing-report.md`, `healing-report.json`, `suggested-fixes.patch` and each prompt it sent. In CI this would open a **pull request**: the full suite runs on it and a human approves it. Healing a locator *in memory* during a nightly run is acceptable only if the run is clearly marked as "healed" and a PR is raised, so locator drift is never hidden.

## 3. Results (heuristic engine)

| Broken | Healed to | Validation |
|---|---|---|
| `#apply-btn` | `getByRole('button', { name: 'Apply filters' })` | ✅ unique · visible · role · applies the chosen filter |
| absolute XPath | `getByRole('combobox', { name: 'Status' })` | ✅ unique · visible · role · keeps the selected value |
| `.results-summary` | `getByTestId('result-count')` | ✅ unique · visible · text matches the summary format |
| `canvas#chart-0` | `getByRole('img', { name: 'Daily transaction volume chart' })` | ✅ unique · visible · role · live chart with data |
| `button.btn-primary.submit-transfer` | `getByRole('button', { name: 'Send transfer' })` | ✅ unique · visible · role · sends a transfer request |

## 4. Next steps
* Wrap locators in a fixture that heals on failure at runtime, as well as through the batch runner.
* Store a **fingerprint** of each element when tests pass (role, name, test id, position in the ARIA tree), and compare against that last known-good state.
* Track how often each locator is healed. A locator that keeps breaking points to an unstable area of the UI that needs proper `data-testid`s.
