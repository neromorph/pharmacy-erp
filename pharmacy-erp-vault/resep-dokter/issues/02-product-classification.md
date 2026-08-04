# 02 Product classification and fractional columns

Type: task
Status: resolved

## Question

Add two columns to `products`: `allow_fractional BOOLEAN NOT NULL DEFAULT FALSE` and `regulatory_category` with the five-class CHECK (BEBAS / BEBAS_TERBATAS / KERAS / PSIKOTROPIKA / NARKOTIKA, default BEBAS). Provide the Product master-data UI so a tenant can set both on an existing product.

Behaves as the prerequisite for the cart auto-flip gate (issue 05) and unblocks the existing Kartu Stok regulatory-category filter TODO (`apps/web/app/kartu-stok/actions.ts`).

## Acceptance

- Migration adds both columns with the CHECK constraint; applied to remote.
- Product create/edit form exposes `allow_fractional` (toggle) and `regulatory_category` (select).
- Kartu Stok regulatory filter dropdown now functional (reads `products.regulatory_category`).

Blocked by: none

## Answer

Resolved in session. Migration `20260804000004_product_classification.sql` adds `products.allow_fractional BOOLEAN NOT NULL DEFAULT FALSE` and `products.regulatory_category TEXT NOT NULL DEFAULT 'BEBAS'` with the five-class CHECK, applied to remote and verified. New `/products` page (web server actions + Supabase direct, OWNER/PHARMACIST/INVENTORY edit-gated) supports create and per-row edit of both fields plus sku/name/base unit/category/min stock/rack. Kartu Stok filter now exposes a Regulatory Category dropdown reading `regulatory_category`, resolving to product ids. Live-verified: login → Products page shows the two columns and form controls; Kartu Stok filter present, KERAS filter returns zero for current data. Repo green (api 6/6, web 30/30, all builds). Commit `5b2d74a`, deployed.