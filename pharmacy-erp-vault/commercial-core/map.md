## Destination

Ship the P0+P1 "commercially deployable core" end-to-end: **Shift Management**, **Kartu Stok & Regulatory Audit**, **Tenant & Team Settings**, and **Receipt Printing**, built on the current convention (Postgres RPC/views + web server actions, no NestJS deployment) and **deployed to the live VPS**. P2 (Accounts Payable, Resep Dokter) is intentionally excluded and stays fog.

## Notes

- **Tracker**: this vault. Format per `pharmacy-erp-vault/agents/issue-tracker.md`.
- **Domain**: pharmacy retail + Indonesian regulatory compliance. Read `CONTEXT.md` and `AGENTS.md` first. ASD-STE100 in all output.
- **Skills**: `/wayfinder`, `/grilling`, `/domain-modeling`, `/prototype`, `/research`. Web queries Supabase directly via the server client.
- **Locked decisions** (resolved in grilling, recorded below) are the backbone. The ledger is a **derived view**, not a table; everything reuses existing immutable rows.
- **Drift rule, amended (Q6)**: `service_role` is allowed **only** in OWNER-gated server actions for GoTrue auth-admin operations (invite/deactivate). Never client-side, never for data reads.

## Decisions so far

- [Shift opening balance seeded by initial opname](issues/) — running balance = initial (first approved opname) + movements; the shipped opname flow *is* the go-live seed.
- [Ledger is a derived view/RPC](issues/) — compute from existing `goods_receipt_items` / `sale_items` / `stock_opname_items`; no new ledger table.
- [Shift reconciliation excludes cash expenses](issues/) — expected = opening_cash + cash sales only; variance = actual − expected.
- [Follow current convention, no NestJS](issues/) — new features are Postgres RPC/views + server actions.
- [Shifts attribute sales by `sale.shift_id` FK](issues/) — explicit column, not a time-window heuristic.
- [OWNER-gated service_role carve-out](issues/) — invite/deactivate only, key server-side, RLS still enforced.
- [Staff role chosen at invite; deactivate = RLS flag](issues/) — pick role on invite; revocation flips a flag (reversible, audit trail intact).
- [`window.print()` CSS receipts](issues/) — 58/80mm via `@media print`; no Web Bluetooth/USB.
- [Client-side export](issues/) — SheetJS `xlsx` + print-to-PDF; no server-side file generation.
- [Store profile = columns on `tenants`; logo in Storage bucket](issues/) — `tenants.logo_url` + tenant-scoped storage RLS.
- [Self-close + owner force-close; no auto-close](issues/) — cashier closes own shift; owner can force-close any; stays open across midnight.

## Not yet specified

- **Regulatory report content** — what exactly each BPOM/SIPNAP report (OOT, Prekursor, Psikotropika/Narkotika) must list: columns, dates, signatures. Sharpened as a research ticket.
- **Kartu Stok filter surface** — exact filters (product, batch, date range, movement type) and whether the ledger view is batch-level or product-level.
- **Receipt data wiring** — which fields flow onto the thermal receipt (store profile, SIA/SIPA via `tenants`).
- **Shift POS blocking UX** — the exact rule for "no active shift → can the POS open?" and how a mid-shift staff change is handled.

## Out of scope

- Accounts Payable / hutang PBF (P2) — scheduled follow-up effort.
- Prescription & patient management / Resep Dokter (P2) — scheduled follow-up effort; needs `regulatory_category` (decided here) as a prerequisite.
- Hardware Bluetooth/USB printer driver code — superseded by the `window.print()` decision.
- Multi-branch, SATUSEHAT, full OOT dosing rules — later phases.