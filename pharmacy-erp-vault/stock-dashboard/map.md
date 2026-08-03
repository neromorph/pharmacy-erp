## Destination

A dashboard that shows exactly three KPIs — daily sales, low stock, and near-expiry — backed by stock alert and stock adjustment (opname) flows. All existing phases (master data, procurement, POS) are shipped; nothing before them is on this map.

## Notes

- Domain: pharmacy stock + sales analytics. Read `CONTEXT.md` and `AGENTS.md` first. Follow ASD-STE100 Simplified Technical English.
- Skills: `/wayfinder`, `/grilling`, `/domain-modeling`. The web UI queries Supabase directly via the server client (NestJS API is not deployed — do not assume an API hop).
- Drift rule: no `service_role` in request paths; RLS filters by JWT `app_metadata.tenant_id`.
- Tracker: this vault. Format per `docs/agents/issue-tracker.md`.

## Decisions so far

- [01 Define the three KPI rules](issues/01-kpi-rules.md) — near-expiry: 30d flag-sensitive / 60d other; low-stock: total <= min_stock_level (zero-stock always flagged); daily sales: PAID minus VOID, WIB (Asia/Jakarta) calendar day, IDR.
- [02 Stock opname and adjustment flow](issues/02-opname-flow.md) — batch-level, session-based `stock_opnames`/`stock_opname_items`, DRAFT→PENDING_APPROVAL→APPROVED|CANCELLED, batch quantity changes only on APPROVED, immutable log; only OWNER/PHARMACIST approve, INVENTORY/CASHIER never self-approve, role from `app_metadata`.
- [03 Dashboard source](issues/03-dashboard-source.md) — single `get_dashboard_kpis()` Postgres RPC, SECURITY INVOKER (RLS passthrough), one JSON payload with the three KPI numbers, one HTTP roundtrip.
- [04 Void restores stock to batches](issues/04-void-restores-stock.md) — VOIDED sale returns qty to its exact batch (reverse FEFO); only OWNER/PHARMACIST may void (no cashier self-void); gated on role in 05.
- [05 Provision role in app_metadata](issues/05-provision-role.md) — role in `app_metadata.role`, enum OWNER/PHARMACIST/INVENTORY/CASHIER, first tenant user=OWNER, staff invites default CASHIER, read from JWT.

## Not yet specified

_(none — the route to the destination is now clear: all decisions are made; the next step is implementation.)_

## Out of scope

- Prescription tracking, compliance (hard drugs/psychotropics), multi-branch, SATUSEHAT — later phases, beyond this effort.