## Destination

A dashboard that shows exactly three KPIs — daily sales, low stock, and near-expiry — backed by stock alert and stock adjustment (opnudge) flows. All existing phases (master data, procurement, POS) are shipped; nothing before them is on this map.

## Notes

- Domain: pharmacy stock + sales analytics. Read `CONTEXT.md` and `AGENTS.md` first. Follow ASD-STE100 Simplified Technical English.
- Skills: `/wayfinder`, `/grilling`, `/domain-modeling`. The web UI queries Supabase directly via the server client (NestJS API is not deployed — do not assume an API hop).
- Drift rule: no `service_role` in request paths; RLS filters by JWT `app_metadata.tenant_id`.
- Tracker: this vault. Format per `docs/agents/issue-tracker.md`.

## Decisions so far

<!-- one line per resolved ticket: gist + link -->

## Not yet specified

- The dashboard layout and how the three KPI cards are presented after their rules are set (graduates after 01 and 03).
- Whether reception/opname shares a stock-tree query with the dashboard, or each runs its own query.

## Out of scope

-_(none yet — nothing on this route is ruled out so far.)_