## Destination

Sellable pharmacy retail ERP v1. Goal: core retail flow feels fast, safe, and clear enough to ship and sell.

## Notes

- Focus on retail ERP only.
- Do not add manufacturing scope.
- Use current domain terms from `CONTEXT.md`.
- Use ASD-STE100 Simplified Technical English in notes and comments.
- Keep scope small. Prefer flow polish over new modules.

## Decisions so far

- Sellable v1 means strong POS, procurement, stock, finance, reports, onboarding, audit, and basic commercial readiness.
- Manufacturing scope is out of scope for this effort.
- POS speed ticket answer: keep barcode-first entry, keyboard shortcuts, auto-focus, and lighter new-sale screen; no offline mode or new POS engine yet.
- Onboarding ticket answer: add one first-run checklist, link to existing setup pages, and keep wizard scope minimal.
- Stock opname ticket answer: add FEFO and expiry hints, batch badges, and stronger guard text; no new merged stock screen.
- Procurement ticket answer: show PO and receipt summary clearly, prefill when possible, and validate rows before submit; no merge of draft/approval/receipt.
- Error-state ticket answer: standardize empty, error, and loading states on key screens; keep it simple and local.
- Audit ticket answer: show actor and timestamp on sensitive actions with existing fields; no new audit subsystem yet.
- Role ticket answer: show role and permission hints near actions, and keep restrictions explicit; no full permission matrix UI.
- Implementation shipped (2026-08-07, three commits): POS scan+shortcuts (Alt+A/Alt+R/Escape, auto-focus), dashboard first-run checklist, opname expiry badges + FEFO hint + qty-diff highlight.
## Not yet specified

- Exact order for Phase 1 tickets.
- Which pages need keyboard flow first.
- Which onboarding steps need wizard UI versus simple empty-state help.
- Which reports are mandatory for first sale.

## Out of scope

- Production Order, BOM, QM, eBMR, MES, EAM, potency management, and other manufacturing stack work.
