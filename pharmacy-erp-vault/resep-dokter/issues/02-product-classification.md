# 02 Product classification and fractional columns

Type: task
Status: claimed

## Question

Add two columns to `products`: `allow_fractional BOOLEAN NOT NULL DEFAULT FALSE` and `regulatory_category` with the five-class CHECK (BEBAS / BEBAS_TERBATAS / KERAS / PSIKOTROPIKA / NARKOTIKA, default BEBAS). Provide the Product master-data UI so a tenant can set both on an existing product.

Behaves as the prerequisite for the cart auto-flip gate (issue 05) and unblocks the existing Kartu Stok regulatory-category filter TODO (`apps/web/app/kartu-stok/actions.ts`).

## Acceptance

- Migration adds both columns with the CHECK constraint; applied to remote.
- Product create/edit form exposes `allow_fractional` (toggle) and `regulatory_category` (select).
- Kartu Stok regulatory filter dropdown now functional (reads `products.regulatory_category`).

Blocked by: none