# AGENTS.md

Operational state for the pharmacy-erp project: progress, next steps, infrastructure, and knowledge. All markdown files live in the Obsidian vault at `pharmacy-erp-vault/`. Domain vocabulary lives in `pharmacy-erp-vault/CONTEXT.md`; deep infra details in `pharmacy-erp-vault/supabase-deployment.md`.

## Project

SaaS dashboard for pharmacy **sales (POS)**, **procurement**, and **stock** management. Multi-tenant; one tenant = one store branch.

- **Frontend:** Next.js 16 (App Router) + Tailwind v4 (`@theme` CSS-first) + shadcn/ui (base-ui idiom: `<Button render={<Link/>}>`) + lucide-react — `apps/web`
- **Backend:** NestJS 11 — `apps/api`
- **Database/Auth:** Supabase self-hosted on remote VPS (Row-Level Security via JWT `app_metadata.tenant_id`)
- **Shared domain:** `packages/domain` (constants/types)
- **Package manager:** Bun 1.4 (workspace; `trustedDependencies` in root `package.json`)
- **TypeScript:** 7.0.2 everywhere. The API builds with plain `tsc -p tsconfig.build.json` (the tsgo CLI) — `@nestjs/cli` needs the compiler API that returns in TS 7.1. Tests run on vitest (ts-jest removed). Revisit `@nestjs/cli` at TS 7.1 stable.

## Status

### Done
- Workspace skeleton (web/api/domain), all tests + builds green (`bun run test`, `bun run build`)
- Domain docs: `pharmacy-erp-vault/CONTEXT.md`, ADRs in `pharmacy-erp-vault/adr/` (tenant=branch, FEFO primary, UI reference, user=one tenant)
- Auth: Supabase login page + middleware (`apps/web`), NestJS JWT strategy extracting `tenant_id` (`apps/api/src/auth`), provisioning script (`scripts/provision-tenant.ts`)
- Master data: `tenants`, `products`, `product_units`, `product_batches` tables with RLS (migration in `supabase/migrations/`); NestJS `ProductsModule` with scoped Supabase service
- **Procurement locked (design)**: separate `suppliers` table (name, is_pbf, pbf_license_number, phone, payment_terms_days); PO status machine DRAFT→PENDING_APPROVAL→APPROVED→RECEIVED / CANCELLED with 1-step conditional approval (Owner/Pharmacist direct-approve; Inventory/Purchasing needs approval)
- **Procurement implemented**: `suppliers`, `purchase_orders`, `purchase_order_items`, `goods_receipts`, `goods_receipt_items` tables (RLS, migration applied to remote DB); PO state machine DRAFT→PENDING_APPROVAL→APPROVED→RECEIVED / CANCELLED with 1-step conditional approval; NestJS `ProcurementModule` (supplier + PO + receiveGoods API); web UI at `/suppliers`, `/procurement`, `/procurement/new`, `/procurement/[id]`, `/procurement/[id]/receive`. Web pages query Supabase directly via the server client (NestJS API is not deployed). `product_batches.current_qty` is `NUMERIC(14,3)`.
- **POS implemented**: `sales`, `sale_items`, `sale_payments` tables (RLS; applied to remote; `sale_items` batch columns nullable, backfilled at pay). NestJS `SalesModule` with FEFO `allocateFefoBatches` (oldest expiry first) and `paySale`. Web UI at `/sales`, `/sales/new`, `/sales/[id]` with cart, FEFO stock table, and complete-sale payment action.
- **Commercial-core UI (Tasks 1-5) implemented**: shift management (`shifts` table + `shift_status` enum + `sales.shift_id` FK + `shift_id` stamped on draft create; pages `/shifts`, `/shifts/new`, `/shifts/[id]`; hard-block no open shift, one shift per cashier, opening cash required, draft blocks close; close old/open new on staff change; expected closing = opening + CASH-only payments); Kartu Stok ledger view (`/kartu-stok`, batch-level running balance, IN/OUT/ADJUSTMENT/VOID, product-grouped default + batch view, search by name/SKU, anchor = first approved opname `physical_qty_base`, later opnames `variance_qty_base`); receipt print page (`/receipts/[saleId]`, thermal CSS 80/58mm via `?w=`, cashier via `sales.shift_id → shifts.cashier_name`, SPLIT/MULTI tender, store header from `tenants`); tenant settings (`/settings`, OWNER-gated, edit name/address/phone/SIA/SIPA/receipt_footer, logo upload to public `tenant-logos` Storage bucket tenant-scoped RLS). Migrations: `20260804000000_create_shifts.sql`, `20260804000001_shift_cashier_name.sql`, `20260804000002_tenant_profile.sql` (all applied to remote). Pure helpers in `apps/web/lib/{shifts,kartu-stok,receipt,settings}.ts` with vitest.
- **Stock dashboard + opname implemented**: `stock_opnames`/`stock_opname_items` tables + `get_dashboard_kpis()` RPC (SECURITY INVOKER, single json: daily_sales PAID−VOID WIB Asia/Jakarta, low_stock_count total<=min incl zero-stock, near_expiry_count products w/ any batch 30/60d window) — migration applied to remote, verified live E2E. Roles in `app_metadata.role` enum OWNER/PHARMACIST/INVENTORY/CASHIER; provisioned users backfilled via admin API. Web 3-KPI dashboard at `/`. `voidSale` restores batch qty (only PAID voidable). `getUserRole`/`canApproveOpname`/`canVoidSale` web helpers in `apps/web/utils/auth.ts`.
- **Accounts Payable v1 implemented**: `accounts_payables` (one row per `goods_receipts`, UNIQUE FK) + `accounts_payable_payments` tables, `accounts_payable_status` enum UNPAID/PARTIAL/PAID/OVERDUE, RLS + indexes. Auto-create via two DB triggers (receipt header shell + receipt-items sync keeps total/remaining in sync, `remaining_amount = GREATEST(total - paid, 0)`), backfill for existing receipts; due date = `received_at + suppliers.payment_terms_days`. Applied to remote as `supabase_admin`, live-verified (trigger test rolled back). Web UI at `/finance/payables` (inbox list sorted by due date, payout form amount/method/notes, status derived at render via `getPayableStatus`), server action `postPayout` validates amount, inserts payment, recomputes balances. Helpers in `apps/web/lib/accounts-payable.ts` + vitest. Plan: `docs/superpowers/plans/2026-08-05-finance-payables.md`, map: `pharmacy-erp-vault/accounts-payable/map.md` (all tickets resolved).
- **Resep Dokter & Obat Racikan (Path B) implemented** — map `pharmacy-erp-vault/resep-dokter/map.md`, all 6 tickets live-verified: product classification (`products.allow_fractional` BOOLEAN DEFAULT FALSE, `products.regulatory_category` TEXT BEBAS/BEBAS_TERBATAS/KERAS/PSIKOTROPIKA/NARKOTIKA — migration `20260804000004`); prescription master data (`doctors` + `patients` tables with tenant RLS, `sales.sale_type` enum OTC/RESEP, `sales.doctor_id`/`patient_id` ON DELETE SET NULL, `sales.tuslah_amount`/`embalase_amount` — migration `20260804000005`); racikan bundle schema (`sale_items.product_id` nullable, `sale_items.parent_item_id` self-FK ON DELETE CASCADE, `sale_items.embalase_amount`, DB CHECK `check_child_no_embalase` — migration `20260804000006`); POS racikan cart (`apps/web/app/sales/new/cart-builder.tsx` + server actions: compound parent/child builder, fractional entry per `allow_fractional`, two-tiered gate — KERAS auto-flips to RESEP, PSIKOTROPIKA/NARKOTIKA hard gate requires patient address; `sale_items.item_name` — migration `20260804000007`); clinical receipt (`/receipts/[saleId]` shows doctor/patient header, parent/child lines with collapsible ingredients, Embalase + Tuslah rows). Web pages: `/doctors`, `/patients` (OWNER-gated CRUD), `/products` (classification fields). Pure helpers in `apps/web/lib/compound.ts` with vitest.
- **BPJS/JKN zero-fee rule (SE 031/XI/2014) implemented**: `sale_type` enum gets `BPJS` value; `patients.bpjs_number TEXT` nullable column; DB CHECK `check_bpjs_zero_fees` guards zero tuslah+embalase at DB level; `get_sipnap_report` groups `sale_type IN ('RESEP','BPJS')` as `pengeluaran_resep`; cart builder: `BPJS / JKN` option locks tuslah and embalase inputs, forces prescription gate (doctor+patient required), shows green badge; BPJS Number Guard — Pay button disabled with warning when patient has no `bpjs_number`; patients form + table include `bpjs_number` field; receipt and sale detail show `BPJS / JKN` badge + `No. Peserta: <number>`; `isBpjsCheckoutBlocked` helper with vitest; `apps/web/app/sales/new/actions.ts` fixed to accept `BPJS` as valid sale type. Migration `20260806000002` applied to remote. Spec: `docs/superpowers/specs/2026-08-06-bpjs-zero-fee.md`. Plan: `docs/superpowers/plans/2026-08-06-bpjs-zero-fee.md`.
- **App shell + UI rebuild (2026-08-06)**: route groups `(auth)/(app)/(print)`; fixed sidebar (7 nav groups, `/sales` teal primary) + header (shift-open dot pinned to Asia/Jakarta, role badge); ALL pages restyled Tailwind v4 + shadcn (receipts keep thermal CSS); plan `docs/superpowers/plans/2026-08-06-app-shell-ui.md`
- **Remote Supabase deployed** (2nd instance `pharmacy-supabase` on `185.197.250.97`) — live at `https://pharmacy-api.nmrooms.biz.id`, studio at `https://pharmacy-studio.nmrooms.biz.id`
- RLS verified end-to-end: login → JWT carries tenant_id + role → scoped product CRUD works (201)
- Provisioned: tenant "Apotek Sehat" + users `owner@mufid.dev` (role OWNER), `cashier@mufid.dev` (role CASHIER) (pw `Test1234!`)

### Next plan (phase order)

Done: procurement, POS (sales), stock, dashboard, prescriptions + racikan, accounts payable v1 + v2, SIPNAP v1, SATUSEHAT dispensing (all live). SATUSEHAT: async queue (`satusehat_submissions` + `satusehat_tokens` tables, `FOR UPDATE SKIP LOCKED`, `pg_cron`/`pg_net` → `GET /api/satusehat/process-queue`), OAuth2 client-credentials token cache, patient/doctor IHS lookup (NIK→IHS), KFA soft-gate (`products.kfa_code`, SKIPPED rows for missing codes), tenant credentials in `/settings` + Test connection, submission status/retry on `/sales/[id]` (FAILED retryable by OWNER/PHARMACIST). FHIR chain live-verified against sandbox: Location → Encounter → MedicationRequest → MedicationDispense per drug line (authorizingPrescription MANDATORY). Live DB has SENT submissions with `fhir_ids`. Plan `docs/superpowers/plans/2026-08-06-satusehat-dispensing.md`, map `pharmacy-erp-vault/satusehat/map.md` (all 9 tickets resolved). **Remaining: production go-live** — human task ticket `pharmacy-erp-vault/satusehat/issues/10-production-credentials.md` (Partner System production registration → `client_id`/`client_secret`/`org_id` → base URL flip → verify one live RESEP sale). AP v2: `purchase_returns` + `purchase_return_items` tables + `accounts_payable_payments.credit_applied_amount` (migration applied to remote); returns = supplier credit note that never mutates the original payable; payout applies unapplied credit first (FIFO); `/procurement/returns` list/new/detail (user-choice batch, stock guard + decrement); aging cards (Belum Jatuh Tempo / 1-30 / 31-60 / 61-90 / >90) + CSV + credit chips on `/finance/payables`; supplier statement ledger at `/suppliers/[id]` with A4 print and linked invoices. Plan `docs/superpowers/plans/2026-08-06-purchase-returns.md`, map `pharmacy-erp-vault/accounts-payable-v2/map.md` (all tickets resolved). Browser E2E verified live on the domain (return → credit chip → credit-first payout → statement closing). SIPNAP: `get_sipnap_report` RPC + `sipnap_exports` audit table on remote; `/reports/sipnap` page (month picker, inbox, CSV download); fix-metadata form on `/sales/[id]`; plan `docs/superpowers/plans/2026-08-05-sipnap-reporting.md`, map `pharmacy-erp-vault/sipnap-reporting/map.md` (all tickets resolved). SIPNAP v2: `stock_destructions` + `stock_destruction_items` (BAP required, witness_names, OWNER/PHARMACIST only, hard batch decrement); `sales.sale_type` now OTC/RESEP/SARANA with facility-name validation; report splits Pemasukan PBF/Sarana + Pengeluaran Resep/Sarana + Dimusnahkan; hard-blocks NEGATIVE/BAP/CONTINUITY (drop IN/HB); `/reports/sipnap` tabs Generate/History with stored snapshot (hash + generated_by + payload) and re-download. Plan `docs/superpowers/plans/2026-08-06-sipnap-v2.md`, map `pharmacy-erp-vault/sipnap-v2/map.md` (all tickets resolved). Browser E2E verified live: BAP-E2E-001 destruction (batch 10→7), negative-saldo block, stored export + history download. **Storage fixed**: the `sipnap-archives` bucket was unusable because `GLOBAL_S3_BUCKET` was unset in `~/pharmacy-supabase/.env` — the file backend uses it as the top-level directory name (template default `stub`), and an empty value made every object key absolute (`Invalid key: /storage-single-tenant/... must be a relative path`). Fixed on the VPS (added `GLOBAL_S3_BUCKET=stub`; storage-api stays pinned v1.60.4 per template). Export snapshot lives back in the bucket (`storage_url` on the row, re-download via signed URL); `sipnap_exports.payload` (`{csv, products}`) is kept as a fallback for pre-fix rows.
- **Web app deployed to VPS**: live at `https://pharmacy.nmrooms.biz.id` (Traefik + Cloudflare, Docker image `pharmacy-erp-web:latest`, compose in `~/pharmacy-erp/compose.yaml` on VPS). **Deploy = GitHub Actions only** (single pipeline in `.github/workflows/ci.yml`): on **any push to `main`**, CI builds web+api images, pushes them to Docker Hub, then the runner joins the tailnet (Tailscale GitHub Action) and SSHes to the VPS to run `docker compose pull && docker compose up -d`. The workflow ships the repo `compose.yaml` to the VPS before pulling, so the repo is the source of truth — do NOT build images on the VPS and do NOT rsync the repo to the VPS; a changed deploy must come from a pushed commit. Any local file changes need a commit + push to deploy. `workflow_dispatch` forces a re-deploy without code changes. VPS `.env` must include `DOCKERHUB_USERNAME` (compose interpolates image names). NestJS API image built but not routed. Browser E2E via firecrawl interact on the domain (login → payables payout flow verified live: UNPAID→PARTIAL→PAID; SIPNAP page renders).

- **Integration test harness implemented (2026-09-03)**: Vitest suite in `apps/web/tests/integration/` tests the API contract from server actions to the **live remote Supabase**. Mocks only `next/headers` (in-memory cookie jar fed by a real password sign-in) and `next/navigation` (redirect throws). Each run provisions a unique `IT ...` tenant via service-role admin API, seeds products/batches, and deletes everything in `afterAll`. Run with `bun run test:integration` (not part of `bun run test`); CI runs it in the quality job with secrets `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_*`. Phase 1 = POS checkout (open shift, draft totals, paySale FEFO deduction, insufficient-stock guard, no-open-shift block). Phases queued: goods receipt + AP trigger, purchase return + credit payout, sale void, shifts/opname/reports. `paySale`/`voidSaleAction` moved from the sale page to `apps/web/app/(app)/sales/[id]/actions.ts` so tests can import them. Harness caught a live bug: staff sync trigger blocked admin user creation — fixed in migration `20260806000008` (live DB is `supabase` on port 5433, not `postgres`; see `pharmacy-erp-vault/lessons-learned/staff-sync-trigger-blocked-admin-user-creation.md`).
- **Toolchain migrated (2026-09-03)**: TypeScript 7.0.2 everywhere (API builds with plain `tsc -p tsconfig.build.json` — `@nestjs/cli` needs the TS 7.1 compiler API); tests on vitest 4 (ts-jest removed); Bun 1.4 as package manager (bun.lock, CI on `oven-sh/setup-bun@v2`, `oven/bun:1-slim` builder stages, comment-free Dockerfiles); Docker runtime images stay `gcr.io/distroless/nodejs24-debian13`. Boot gate caught + fixed missing `class-validator`/`class-transformer` runtime deps. See `pharmacy-erp-vault/adr/0006-bun-package-manager-and-typescript-7.md` and `pharmacy-erp-vault/lessons-learned/boot-gate-caught-missing-validation-deps.md`.
1. Later: multi-branch, SATUSEHAT.

## Commands

```bash
bun install                 # install all workspaces
bun run test                # all tests
bun run build               # all builds
bun run --filter @pharmacy/web dev      # frontend (port 3000)
bun run --filter @pharmacy/api dev      # backend (port 3000 conflict — run with PORT=3001)
bun run provision -- <email> <pw> <tenant-name>   # create tenant+user (loads .env.local)
```

- NestJS dev uses port 3000 by default; Next dev also 3000 — start one on a different port (`PORT=3001 bun run --filter @pharmacy/api dev`).

## Infrastructure / Knowledge

### Remote server
- `mufid@100.119.164.5` (Tailscale) = public `185.197.250.97`, 8GB RAM / 4 CPU
- Traefik reverse proxy (Docker, network `traefik_web`), Cloudflare DNS + certs
- **Two Supabase instances:** `~/supabase` (kuitansi) and `~/pharmacy-supabase` (this project, containers `pharmacy-*`)

### Supabase gotchas (learned the hard way)
- Cloudflare Universal SSL covers only **one label**: use `pharmacy-api.nmrooms.biz.id`, **not** `api.pharmacy.nmrooms.biz.id`
- Run migrations as **`supabase_admin`** role (public schema CREATE is restricted for `postgres`)
- New tables auto-get grants for `anon`/`authenticated`/`service_role`
- Bun 1.4: scripts run under Bun; lifecycle scripts gated (`trustedDependencies` in root `package.json`)
- If Traefik loses docker.sock access: `docker compose up -d --force-recreate` (needs group 988)
- Email autoconfirm is ON for dev provisioning — revisit for production

### Env vars (never commit real values)
- `.env.local`, `apps/web/.env.local`, `apps/api/.env.local` hold live credentials — the VPS `~/pharmacy-erp/.env` is the source of truth for production values. `pharmacy-erp-vault/supabase-deployment.md` holds **placeholders only** (real values were purged from git history in 2026-08; rotate the Cloudflare API token, Supabase service_role key, and JWT secret if they may have been scraped while public)

## Rules for agents

- **Every feature change ships with integration tests.** When a feature is added, changed, or removed, update `apps/web/tests/integration/` in the same commit: new tests for new flows, adjusted tests for changed contracts, deleted tests for removed flows. The suite tests server actions against the live Supabase; keep `bun run test:integration` green. Never weaken an assertion to make a test pass.
- **Always use ASD-STE100 Simplified Technical English** (controlled vocabulary, short sentences, one meaning per word) in all written output: code comments, commit messages, ADRs, docs, and chat responses.
- Avoid jargon, idioms, passive voice, and long sentences. Prefer simple approved words. Use the noun/verb directly.
- Example: "We end the process" not "We are going to be concluding the operation in the near future."
- Follow `pharmacy-erp-vault/CONTEXT.md` vocabulary (FEFO, Batch, Goods Receipt, etc.) and UI reference (Emerald/Teal on Slate, light-first, compact, no dark POS screens)
- Record architecture decisions as `NNNN-short-title.md` in `pharmacy-erp-vault/adr/`, and incident RCAs in `pharmacy-erp-vault/lessons-learned/`. Link related notes with `[[wikilinks]]`.
- Respect RLS: backend passes the user's JWT through; never use service_role in request paths
- Tests: keep `bun run test` + `bun run build` green after every change
- Git repo initialized (main branch). Commits are expected; keep the tree clean.

## Agent skills

### Issue tracker

Issues, specs, and wayfinding maps live as markdown files in the Obsidian vault at `pharmacy-erp-vault/` in this repo. See `pharmacy-erp-vault/agents/issue-tracker.md`.

### Domain docs

Single-context: `pharmacy-erp-vault/CONTEXT.md` + `pharmacy-erp-vault/adr/` (ADRs) + `pharmacy-erp-vault/lessons-learned/` (RCAs). See `pharmacy-erp-vault/agents/domain.md`.
