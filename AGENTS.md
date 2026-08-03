# AGENTS.md

Operational state for the pharmacy-erp project: progress, next steps, infrastructure, and knowledge. All markdown files live in the Obsidian vault at `pharmacy-erp-vault/`. Domain vocabulary lives in `pharmacy-erp-vault/CONTEXT.md`; deep infra details in `pharmacy-erp-vault/supabase-deployment.md`.

## Project

SaaS dashboard for pharmacy **sales (POS)**, **procurement**, and **stock** management. Multi-tenant; one tenant = one store branch.

- **Frontend:** Next.js 16 (App Router) + Tailwind + shadcn/ui — `apps/web`
- **Backend:** NestJS 11 — `apps/api`
- **Database/Auth:** Supabase self-hosted on remote VPS (Row-Level Security via JWT `app_metadata.tenant_id`)
- **Shared domain:** `packages/domain` (constants/types)
- **Package manager:** pnpm 11 (workspace; corepack pin in root `packageManager`)
- **TypeScript:** 6.x everywhere (TS 7 breaks Next 16 + ts-jest — do not upgrade)

## Status

### Done
- Workspace skeleton (web/api/domain), all tests + builds green (`pnpm -r test`, `pnpm -r build`)
- Domain docs: `pharmacy-erp-vault/CONTEXT.md`, ADRs in `pharmacy-erp-vault/adr/` (tenant=branch, FEFO primary, UI reference, user=one tenant)
- Auth: Supabase login page + middleware (`apps/web`), NestJS JWT strategy extracting `tenant_id` (`apps/api/src/auth`), provisioning script (`scripts/provision-tenant.ts`)
- Master data: `tenants`, `products`, `product_units`, `product_batches` tables with RLS (migration in `supabase/migrations/`); NestJS `ProductsModule` with scoped Supabase service
- **Procurement locked (design)**: separate `suppliers` table (name, is_pbf, pbf_license_number, phone, payment_terms_days); PO status machine DRAFT→PENDING_APPROVAL→APPROVED→RECEIVED / CANCELLED with 1-step conditional approval (Owner/Pharmacist direct-approve; Inventory/Purchasing needs approval)
- **Procurement implemented**: `suppliers`, `purchase_orders`, `purchase_order_items`, `goods_receipts`, `goods_receipt_items` tables (RLS, migration applied to remote DB); PO state machine DRAFT→PENDING_APPROVAL→APPROVED→RECEIVED / CANCELLED with 1-step conditional approval; NestJS `ProcurementModule` (supplier + PO + receiveGoods API); web UI at `/suppliers`, `/procurement`, `/procurement/new`, `/procurement/[id]`, `/procurement/[id]/receive`. Web pages query Supabase directly via the server client (NestJS API is not deployed). `product_batches.current_qty` is `NUMERIC(14,3)`.
- **POS implemented**: `sales`, `sale_items`, `sale_payments` tables (RLS; applied to remote; `sale_items` batch columns nullable, backfilled at pay). NestJS `SalesModule` with FEFO `allocateFefoBatches` (oldest expiry first) and `paySale`. Web UI at `/sales`, `/sales/new`, `/sales/[id]` with cart, FEFO stock table, and complete-sale payment action.
- **Stock dashboard + opname implemented**: `stock_opnames`/`stock_opname_items` tables + `get_dashboard_kpis()` RPC (SECURITY INVOKER, single json: daily_sales PAID−VOID WIB Asia/Jakarta, low_stock_count total<=min incl zero-stock, near_expiry_count products w/ any batch 30/60d window) — migration applied to remote, verified live E2E. Roles in `app_metadata.role` enum OWNER/PHARMACIST/INVENTORY/CASHIER; provisioned users backfilled via admin API. Web 3-KPI dashboard at `/`. `voidSale` restores batch qty (only PAID voidable). `getUserRole`/`canApproveOpname`/`canVoidSale` web helpers in `apps/web/utils/auth.ts`.
- **Remote Supabase deployed** (2nd instance `pharmacy-supabase` on `185.197.250.97`) — live at `https://pharmacy-api.nmrooms.biz.id`, studio at `https://pharmacy-studio.nmrooms.biz.id`
- RLS verified end-to-end: login → JWT carries tenant_id + role → scoped product CRUD works (201)
- Provisioned: tenant "Apotek Sehat" + users `owner@mufid.dev` (role OWNER), `cashier@mufid.dev` (role CASHIER) (pw `Test1234!`)

### Next plan (phase order)

1. **Procurement flow** — PO → Goods Receipt (input invoice, batch, ED, stock increase). Schema: `purchase_orders`, `purchase_order_items`, `goods_receipts`, `goods_receipt_items`. API + UI.
2. **POS (Sales)** — scan/search product → FEFO batch deduction → payment → thermal receipt (58/80mm). FEFO allocation is the core logic.
3. **Stock** — low-stock + near-expiry alerts (3 KPIs), stock opname + adjustment.
4. **Dashboard** — 3 KPIs only (daily sales, low stock, near-expiry).
5. Later: prescription tracking, compliance (hard drugs/psychotropics), multi-branch, SATUSEHAT.

## Commands

```bash
pnpm install                 # install all workspaces
pnpm -r test                 # all tests
pnpm -r build                # all builds
pnpm --filter @pharmacy/web dev      # frontend (port 3000)
pnpm --filter @pharmacy/api dev      # backend (port 3000 conflict — run with PORT=3001)
pnpm run provision -- <email> <pw> <tenant-name>   # create tenant+user (loads .env.local)
```

- NestJS dev uses port 3000 by default; Next dev also 3000 — start one on a different port (`PORT=3001 pnpm --filter @pharmacy/api dev`).

## Infrastructure / Knowledge

### Remote server
- `mufid@100.119.164.5` (Tailscale) = public `185.197.250.97`, 8GB RAM / 4 CPU
- Traefik reverse proxy (Docker, network `traefik_web`), Cloudflare DNS + certs
- **Two Supabase instances:** `~/supabase` (kuitansi) and `~/pharmacy-supabase` (this project, containers `pharmacy-*`)

### Supabase gotchas (learned the hard way)
- Cloudflare Universal SSL covers only **one label**: use `pharmacy-api.nmrooms.biz.id`, **not** `api.pharmacy.nmrooms.biz.id`
- Run migrations as **`supabase_admin`** role (public schema CREATE is restricted for `postgres`)
- New tables auto-get grants for `anon`/`authenticated`/`service_role`
- pnpm 11: supply-chain policy (`minimum-release-age=0` in `.npmrc`), build scripts gated (`allowBuilds` in `pnpm-workspace.yaml`)
- If Traefik loses docker.sock access: `docker compose up -d --force-recreate` (needs group 988)
- Email autoconfirm is ON for dev provisioning — revisit for production

### Env vars (never commit real values)
- `.env.local`, `apps/web/.env.local`, `apps/api/.env.local` hold live credentials — see `pharmacy-erp-vault/supabase-deployment.md`

## Rules for agents

- **Always use ASD-STE100 Simplified Technical English** (controlled vocabulary, short sentences, one meaning per word) in all written output: code comments, commit messages, ADRs, docs, and chat responses.
- Avoid jargon, idioms, passive voice, and long sentences. Prefer simple approved words. Use the noun/verb directly.
- Example: "We end the process" not "We are going to be concluding the operation in the near future."
- Follow `pharmacy-erp-vault/CONTEXT.md` vocabulary (FEFO, Batch, Goods Receipt, etc.) and UI reference (Emerald/Teal on Slate, light-first, compact, no dark POS screens)
- Respect RLS: backend passes the user's JWT through; never use service_role in request paths
- Tests: keep `pnpm -r test` + `pnpm -r build` green after every change
- No git repo initialized yet — commits/skills that assume git will fail; `git init` when user asks

## Agent skills

### Issue tracker

Issues, specs, and wayfinding maps live as markdown files in the Obsidian vault at `pharmacy-erp-vault/` in this repo. See `pharmacy-erp-vault/agents/issue-tracker.md`.

### Domain docs

Single-context: `pharmacy-erp-vault/CONTEXT.md` + `pharmacy-erp-vault/adr/`. See `pharmacy-erp-vault/agents/domain.md`.
