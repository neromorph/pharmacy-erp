### Task 7: Restyle Finance, Compliance, Master Data, System + receipts print check

**Pages:** `(app)/finance/payables/page.tsx`, `(app)/reports/sipnap/page.tsx`(s), `(app)/doctors/page.tsx`, `(app)/patients/page.tsx`, `(app)/settings/page.tsx`. Verify `(print)/receipts/[saleId]/page.tsx` print styles unaffected by Tailwind preflight (load with `?w=80`, inspect @media print output).

- [ ] **Steps:** same playbook; payout form in a `Dialog` (keep server action `postPayout` contract); SIPNAP download link = `Button asChild` outline; settings form in a `Card` with submit `Button`. Receipts: if preflight broke any thermal style, add missing rules to globals.css print section (do NOT rewrite receipt markup to Tailwind). Tests + build + lint green. Commit `style(web): Tailwind+shadcn restyle for finance/compliance/master/system pages`.

