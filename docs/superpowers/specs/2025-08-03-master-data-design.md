# Product & Batch Design

## Goal
Implement the Master Data foundation for Products and Batches, including API CRUD and the database schema. This supports the "All 4 units" requirement by treating the base unit as the source of truth, and allows FEFO tracking via the `is_expired_sensitive` flag.

## Architecture

### Database Schema (Supabase)

#### `public.products`
- `id` (UUID, PK)
- `tenant_id` (UUID, FK to tenants) -> RLS isolated.
- `name` (VARCHAR) -> e.g., "Amoxicillin 500mg Kaplet"
- `sku` (VARCHAR) -> Internal unique code per tenant.
- `base_unit` (VARCHAR) -> Smallest tracking unit (Tablet, Botol, Pcs).
- `min_stock_level` (INT) -> Dashboard alert trigger.
- `category` (VARCHAR) -> OBAT_BEBAS, OBAT_BEBAS_TERBATAS, OBAT_KERAS, ALKES, FMCG_NON_OBAT.
- `is_expired_sensitive` (BOOLEAN) -> If true, FEFO rules apply, requiring Batch/ED on receipt.
- `rack_location` (TEXT, null) -> Physical location helper.
- `created_at` / `updated_at` (TIMESTAMPTZ)

#### `public.product_units` (For the "All 4 units" requirement)
Since a product can be sold as Box, Strip, or Tablet, we define multiplier units against the `base_unit`.
- `id` (UUID, PK)
- `product_id` (UUID, FK to products)
- `unit_name` (VARCHAR) -> e.g., "Strip", "Box"
- `multiplier` (INT) -> e.g., 10 (1 Strip = 10 base_unit/Tablet).
- `barcode` (VARCHAR, null) -> Scanner friendly.
- `price` (DECIMAL) -> Selling price for this specific unit.

#### `public.product_batches`
Stock is stored at the batch level. Product total stock is `SUM(batches.current_qty)`.
- `id` (UUID, PK)
- `product_id` (UUID, FK to products)
- `tenant_id` (UUID, FK to tenants) -> RLS isolated.
- `batch_number` (VARCHAR)
- `expiry_date` (DATE) -> Used for FEFO and Near-Expiry alerts.
- `current_qty` (INT) -> Always tracked in `base_unit`.
- `created_at` (TIMESTAMPTZ)

### Backend (NestJS API)
- **Entities/DTOs:** Prisma or TypeORM entities matching the schema (we will use raw SQL/Supabase client or Prisma depending on the stack choice. Let's use the Supabase client directly to leverage RLS naturally with the authenticated user's JWT).
- **Service:** `ProductsService` and `BatchesService`.
- **Endpoints:**
  - `GET /products` (List products with total stock)
  - `POST /products` (Create product + units)
  - `GET /products/:id/batches` (List batches for a product)

### Frontend (Next.js Web)
- **Pages:** `/products` (List view), `/products/new` (Creation form).
- **UI:** Follows the Emerald/Slate design system. High density table for product list.
