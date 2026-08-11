# Error / empty / loading states

Type: task
Status: resolved

## Question

Which core screens need clearer empty, loading, and error states before sellable v1?

## Answer

Current app already has some error and empty states. Gap is consistency, not zero coverage.

Priority screens:
- POS new sale
- Procurement PO / receive
- Stock opname
- Kartu Stok
- Finance payables
- SIPNAP report
- Settings / SATUSEHAT test

Keep scope small for sellable v1:
- Standardize empty-state card with one clear action.
- Standardize error banner text with one next step.
- Add loading text or skeleton only on slow fetch screens.
- Make failed report and failed data load states readable, not generic.
- Do not add global suspense framework now.

Result: core screens stop feeling broken when data is absent or fetch fails.
