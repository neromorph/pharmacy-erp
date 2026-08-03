# Tenant & Auth Design

## Goal
Implement the foundational authentication and tenant isolation layer using Supabase, Next.js, and NestJS. This ensures all subsequent features (POS, Procurement) operate securely within a single branch context.

## Architecture

We use **JWT Claims (`app_metadata`)** to store the user's `tenant_id`. This avoids database joins for Row Level Security (RLS) and strictly enforces the "one user = one tenant" rule.

### Database (Supabase)
- **Table:** `public.tenants` (`id` UUID PK, `name` TEXT, `created_at` TIMESTAMPTZ).
- **RLS Pattern:** Future tables will use the JWT claim directly:
  `tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid`
- **Provisioning:** Since users are staff, there is no public sign-up. We will create a utility script or endpoint to provision a tenant, create a user, and inject the `tenant_id` into `auth.users.app_metadata`.

### Backend (NestJS API)
- **Supabase Strategy:** A Passport strategy (or custom Guard) to validate the Supabase JWT.
- **Request Context:** The guard extracts `sub` (user ID) and `tenant_id` from the JWT and attaches them to the request context for downstream services.

### Frontend (Next.js Web)
- **Library:** `@supabase/ssr` to manage cookies in the App Router.
- **Middleware:** `middleware.ts` to protect routes (redirects unauthenticated users to `/login`).
- **Pages:** A minimal `/login` page using the Emerald/Slate design system.
