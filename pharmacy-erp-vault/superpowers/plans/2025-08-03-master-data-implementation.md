# Master Data (Product & Batch) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Master Data foundation for Products, Units, and Batches. Setup the database schema via migrations (or direct Supabase SQL if no migration tool is configured yet) and build the NestJS API CRUD.

**Architecture:** 
- `products`: Base information (`base_unit`, `is_expired_sensitive`, `category`).
- `product_units`: Selling units (`multiplier`, `barcode`, `price`).
- `product_batches`: Stock holding at the batch level (`batch_number`, `expiry_date`, `current_qty` in base units).
Backend uses `@supabase/supabase-js` passing the user's JWT to leverage Supabase RLS directly.

**Tech Stack:** NestJS, Supabase Postgres, `@supabase/supabase-js`.

## Global Constraints

- One tenant = one pharmacy store branch.
- One user = one tenant only.
- FEFO is the primary stock rule.
- Supplier is the technical model name; PBF is the UI label.
- Dashboard shows only 3 KPIs on day 1.
- Day 1 scope: POS, Procurement, Stock, OTC retail first, Light prescription tracking.
- UI reference: clean clinical enterprise UI, light-first, data-dense, compact, high-contrast, Emerald/Teal primary, Slate neutrals.
- Do not use pure dark theme for operational or checkout screens.
- Do not use low-contrast gray text for medicine dosages or prices.
- Do not use slow transitions above 200ms on POS scanning.

---

### Task 1: Database Migration / Schema Setup

**Files:**
- Create: `supabase/migrations/20250803000000_create_master_data.sql`
- Modify: `package.json`

**Interfaces:**
- Consumes: Supabase database
- Produces: `products`, `product_units`, and `product_batches` tables with RLS policies based on JWT `tenant_id`.

- [ ] **Step 1: Write the failing check**

```bash
test -f supabase/migrations/20250803000000_create_master_data.sql
```

- [ ] **Step 2: Run check to verify it fails**

Run: `test -f supabase/migrations/20250803000000_create_master_data.sql`
Expected: fail because migration doesn't exist.

- [ ] **Step 3: Write minimal implementation**

Create `supabase/migrations/20250803000000_create_master_data.sql`:
```sql
-- Enable UUID extension if not present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Products Table
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name VARCHAR NOT NULL,
    sku VARCHAR NOT NULL,
    base_unit VARCHAR NOT NULL,
    min_stock_level INT NOT NULL DEFAULT 0,
    category VARCHAR NOT NULL,
    is_expired_sensitive BOOLEAN NOT NULL DEFAULT true,
    rack_location TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for products" ON public.products
    FOR ALL
    USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Product Units Table (Selling units)
CREATE TABLE public.product_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    unit_name VARCHAR NOT NULL,
    multiplier INT NOT NULL DEFAULT 1,
    barcode VARCHAR,
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for product_units (Inherits implicitly if queried through product, but we secure it anyway)
ALTER TABLE public.product_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for product_units" ON public.product_units
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.products p 
            WHERE p.id = product_units.product_id 
            AND p.tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid
        )
    );

-- Product Batches Table (Stock holding)
CREATE TABLE public.product_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    batch_number VARCHAR NOT NULL,
    expiry_date DATE,
    current_qty INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for product_batches
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for product_batches" ON public.product_batches
    FOR ALL
    USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);
```

- [ ] **Step 4: Run check to verify it passes**

Run: `test -f supabase/migrations/20250803000000_create_master_data.sql`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat(db): add products and batches schema with rls"
```

---

### Task 2: Create Supabase Client Provider for NestJS

**Files:**
- Create: `apps/api/src/supabase/supabase.service.ts`
- Create: `apps/api/src/supabase/supabase.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `@supabase/supabase-js`, Request object with JWT token
- Produces: A scoped Supabase client instance that passes the current user's JWT, enforcing RLS at the database level.

- [ ] **Step 1: Write the failing check**

```bash
test -f apps/api/src/supabase/supabase.service.ts
```

- [ ] **Step 2: Run check to verify it fails**

Run: `test -f apps/api/src/supabase/supabase.service.ts`
Expected: fail.

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/src/supabase/supabase.service.ts`:
```ts
import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Request } from 'express';

@Injectable({ scope: Scope.REQUEST })
export class SupabaseService {
  private clientInstance: SupabaseClient;

  constructor(@Inject(REQUEST) private readonly request: Request) {
    const authHeader = this.request.headers.authorization;
    
    this.clientInstance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: {
            Authorization: authHeader || '',
          },
        },
      },
    );
  }

  getClient(): SupabaseClient {
    return this.clientInstance;
  }
}
```

Create `apps/api/src/supabase/supabase.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

@Module({
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
```

Modify `apps/api/src/app.module.ts` to import `SupabaseModule`.

- [ ] **Step 4: Run check to verify it passes**

Run: `pnpm --filter @pharmacy/api build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/supabase apps/api/src/app.module.ts
git commit -m "feat(api): add scoped supabase service for rls"
```

---

### Task 3: Create Products API Module

**Files:**
- Create: `apps/api/src/products/products.controller.ts`
- Create: `apps/api/src/products/products.service.ts`
- Create: `apps/api/src/products/products.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `SupabaseService`
- Produces: `GET /products` and `POST /products` endpoints

- [ ] **Step 1: Write the failing check**

```bash
test -f apps/api/src/products/products.controller.ts
```

- [ ] **Step 2: Run check to verify it fails**

Run: `test -f apps/api/src/products/products.controller.ts`
Expected: fail.

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/src/products/products.service.ts`:
```ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CurrentUser } from '../auth/current-user.decorator';

@Injectable()
export class ProductsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll() {
    const supabase = this.supabaseService.getClient();
    // Joins units and calculates total stock from batches
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        product_units (*),
        product_batches (current_qty)
      `);
      
    if (error) throw new InternalServerErrorException(error.message);
    
    // Map data to sum current_qty
    return data.map(p => ({
      ...p,
      total_stock: p.product_batches.reduce((sum: number, b: any) => sum + (b.current_qty || 0), 0)
    }));
  }

  async create(createDto: any, user: any) {
    const supabase = this.supabaseService.getClient();
    const { units, ...productData } = createDto;
    
    // RLS requires tenant_id on insert
    const { data: product, error: pErr } = await supabase
      .from('products')
      .insert([{ ...productData, tenant_id: user.tenantId }])
      .select()
      .single();
      
    if (pErr) throw new InternalServerErrorException(pErr.message);

    if (units && units.length > 0) {
      const unitsData = units.map((u: any) => ({ ...u, product_id: product.id }));
      const { error: uErr } = await supabase.from('product_units').insert(unitsData);
      if (uErr) throw new InternalServerErrorException(uErr.message);
    }
    
    return product;
  }
}
```

Create `apps/api/src/products/products.controller.ts`:
```ts
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProductsService } from './products.service';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(AuthGuard('jwt'))
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Post()
  create(@Body() createDto: any, @CurrentUser() user: any) {
    return this.productsService.create(createDto, user);
  }
}
```

Create `apps/api/src/products/products.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
```

Modify `apps/api/src/app.module.ts` to import `ProductsModule`.

- [ ] **Step 4: Run check to verify it passes**

Run: `pnpm --filter @pharmacy/api build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/products apps/api/src/app.module.ts
git commit -m "feat(api): add products crud endpoints"
```

## Review Checklist

1. Every project-wide rule from `CONTEXT.md` is respected.
2. `tenant_id` RLS isolation is correctly implemented in SQL and API.
3. Total stock is derived from `product_batches` using a sum.
4. No dependencies introduced that aren't listed in the plan.
5. All tasks are independently testable.
