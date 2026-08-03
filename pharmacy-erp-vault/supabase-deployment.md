# Supabase Deployment (Pharmacy ERP)

## Infrastructure

- **Server:** `mufid@100.119.164.5` (Tailscale) = `185.197.250.97` (public IPv4), 8GB RAM, 4 CPU
- **Reverse proxy:** Traefik (Docker, `traefik_web` external network) with Cloudflare DNS challenge
- **DNS:** Cloudflare zone `nmrooms.biz.id` (token: `<cloudflare-api-token: set in VPS ~/.env>`, zone id `<cloudflare-zone-id: set in VPS ~/.env>`)

## Endpoints (pharmacy instance)

| Service | URL |
|---|---|
| API (Kong) | `https://pharmacy-api.nmrooms.biz.id` |
| Studio | `https://pharmacy-studio.nmrooms.biz.id` |
| Site | `https://pharmacy.nmrooms.biz.id` |

## Remote setup (`/home/mufid/pharmacy-supabase`)

- Second self-hosted Supabase instance, cloned from kuitansi, all containers renamed `pharmacy-*`, ports shifted (Kong 8001, Postgres 5433).
- **Do not use 3-level subdomains** (`x.y.nmrooms.biz.id`) — Cloudflare Universal SSL only covers one label; use flat names (`pharmacy-api`, `pharmacy-studio`).

## Credentials (pharmacy project)

| Var | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://pharmacy-api.nmrooms.biz.id` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<supabase-key: set in VPS ~/pharmacy-erp/.env>` |
| `SUPABASE_SERVICE_ROLE_KEY` | `<supabase-key: set in VPS ~/pharmacy-erp/.env>` |
| `SUPABASE_JWT_SECRET` | `<supabase-jwt-secret: set in VPS ~/pharmacy-erp/.env> |
| DB postgres password | `5c8cb6aca3bd8592af6f427b47f591b9` |

Stored locally in `.env.local`, `apps/web/.env.local`, `apps/api/.env.local`.

## Provisioned data

- Tenant: **Apotek Sehat** (`5fef3c6d-431b-4aa2-baf4-3c853dcb4a63`)
- Users:
  - `owner@mufid.dev` / `Test1234!` (Owner, tenant Apotek Sehat)
  - `cashier@mufid.dev` / `Test1234!` (Cashier, tenant Apotek Sehat)

## Verify RLS end-to-end

```bash
# login -> token carries app_metadata.tenant_id
curl -X POST https://pharmacy-api.nmrooms.biz.id/auth/v1/token?grant_type=password \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"owner@mufid.dev","password":"Test1234!"}'

# create product with that token (RLS allows, scoped to tenant)
curl -X POST https://pharmacy-api.nmrooms.biz.id/rest/v1/products \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"5fef3c6d-431b-4aa2-baf4-3c853dcb4a63","name":"X","sku":"X-1","base_unit":"Kaplet","min_stock_level":10,"category":"OBAT_KERAS","is_expired_sensitive":true}'
```

## Apply migrations

Migrations live in `supabase/migrations/`. Apply as `supabase_admin`:

```bash
docker exec -i pharmacy-supabase-db psql -U supabase_admin -d supabase -f /dev/stdin < migration.sql
```

## Notes / gotchas

- `public` schema: `CREATE` is restricted — must use `supabase_admin` role, not `postgres`.
- New tables get default grants to `anon`/`authenticated`/`service_role` automatically.
- Email autoconfirm enabled (`ENABLE_EMAIL_AUTOCONFIRM=true`) for easy provisioning; revisit for production.
- Traefik needed `--force-recreate` to regain docker.sock access (group 988) — it had lost socket access.
