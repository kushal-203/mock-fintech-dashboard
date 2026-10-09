# Self-healing report

Engine: **heuristic** · Generated: 2026-10-09T07:59:10.227Z · Confidence threshold: 0.6

| Locator | Broken selector | Detected | Suggested replacement | Confidence | Validation | Status |
|---|---|---|---|---|---|---|
| applyFiltersButton | `#apply-btn` | no element matched | `page.getByRole('button', { name: 'Apply filters', exact: true })` | 0.99 | ✅ resolves to exactly one element<br>✅ is visible<br>✅ has role "button"<br>✅ click → transactions re-requested with the chosen filter | HEALED (pending human review) |
| statusFilter | `xpath=/html/body/div[1]/main/section[3]/form/label[2]/select` | no element matched | `page.getByRole('combobox', { name: 'Status', exact: true })` | 0.99 | ✅ resolves to exactly one element<br>✅ is visible<br>✅ has role "combobox"<br>✅ select "failed" → value is kept | HEALED (pending human review) |
| resultSummary | `.results-summary` | no element matched | `page.getByTestId('result-count')` | 0.99 | ✅ resolves to exactly one element<br>✅ is visible<br>✅ text looks like "Showing x–y of n transactions" | HEALED (pending human review) |
| trendChart | `canvas#chart-0` | no element matched | `page.getByRole('img', { name: 'Daily transaction volume chart', exact: true })` | 0.99 | ✅ resolves to exactly one element<br>✅ is visible<br>✅ has role "img"<br>✅ element is a live Chart.js chart with data | HEALED (pending human review) |
| sendTransferButton | `button.btn-primary.submit-transfer` | no element matched | `page.getByRole('button', { name: 'Send transfer', exact: true })` | 0.99 | ✅ resolves to exactly one element<br>✅ is visible<br>✅ has role "button"<br>✅ click → transfer request sent and feedback shown | HEALED (pending human review) |

Nothing was changed in the source code. Review suggested-fixes.patch and apply it through a pull request.
