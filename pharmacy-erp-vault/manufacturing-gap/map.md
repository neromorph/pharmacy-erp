## Destination

Define next ERP farmasi scope for manufaktur. Target: clear route for Production Order, BOM/formula, QM, eBMR, MES-facing flow, and related compliance gaps.

## Notes

- Use current project vocabulary from `CONTEXT.md`.
- Keep FEFO, batch-level stock, tenant isolation, and RLS.
- Focus on farmasi manufacturing gap, not retail POS gap.
- Use `/grilling` and `/domain-modeling` for scope and terms.

## Decisions so far

- None yet.

## Not yet specified

- Which first slice should come first: Production Order + BOM, QM, or eBMR.
- Where manufacturing data should live: reuse current ERP tables, add new manufacturing tables, or split into a separate module boundary.
- Which manufacturing compliance items are in-scope for first phase: audit trail, e-signature, validation, batch genealogy, line clearance, deviation/CAPA.
- Which capabilities are only aspirational for later: MES sync, EAM, advanced planning, potency management, matrix inventory, CSOS.

## Out of scope

- Retail POS rework.
- Non-pharmacy manufacturing domains.