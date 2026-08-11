# Supabase stack resource audit — 2026-08-11

Analysis only. Nothing changed on the VPS. Host: `mufid@100.119.164.5` (8GB RAM / 4 CPU, load 1.6, RAM 6.2/7.8GB used, 1.6GB available, 17GB free disk).

## Summary

Stack runs **11 containers, ~1.65GB RAM**. Only **5 are needed** by pharmacy-erp (~830MB). Six services are unused (~**820MB, ~50% of stack**). No analytics/logflare/vector/scheduler services exist in this compose file at all — nothing to disable there.

| Service (container) | Role | Used? | Evidence | RAM |
|---|---|---|---|---|
| db (`pharmacy-supabase-db`) | Postgres 17 | **YES** | all data, triggers, RPCs, pg_net | 114MB |
| kong (`pharmacy-supabase-kong`) | API gateway | **YES** | 1417 req/24h: `/auth/v1` 963, `/rest/v1` ~300, web app only entry | 473MB |
| auth (`pharmacy-supabase-auth`) | GoTrue | **YES** | 1976 log lines/24h, session polling from web | 18MB |
| rest (`pharmacy-supabase-rest`) | PostgREST | **YES** | web queries, direct DB conn (authenticator) | 60MB |
| storage (`pharmacy-supabase-storage`) | Storage API | **YES** | logos + sipnap archives (`getPublicUrl` in `settings/actions.ts`); 0 hits in 24h window but required | 158MB |
| studio (`pharmacy-supabase-studio`) | Admin UI | **NO** | 0 traefik hits/24h (`pharmacy-studio.nmrooms.biz.id`), 0 logs | 228MB |
| meta (`pharmacy-supabase-meta`) | pg-meta (studio backend) | **NO** | only studio calls it | 122MB |
| realtime (`pharmacy-realtime-dev.supabase-realtime`) | Realtime | **NO** | 0 kong hits, no `.channel(` in apps/web (realtime-js is transitive dep of supabase-js only), logs = janitor/promex only | 192MB |
| supavisor (`pharmacy-supabase-pooler`) | Pooler | **NO** | 0 client traffic: auth/rest/storage connect directly to `db:5433` (`POSTGRES_HOST=db`); pg_stat_activity shows only supavisor's own cluster conns; logs = healthchecks only | 194MB |
| imgproxy | image transforms | **NO** | 0 hits; web uses `getPublicUrl` only (no transform params) | 58MB |
| edge-functions (`pharmacy-supabase-edge-functions`) | Edge runtime | **NO** | 0 kong hits, 0 logs; `volumes/functions` holds template leftovers (hello/main/create-snap-token/midtrans-webhook) | 25MB |

Other facts:
- **Second stack (kuitansi) `~/supabase` exists but is NOT running** (no containers, no compose project). No conflict.
- Host listeners from stack: `0.0.0.0:5433` (pooler) + random `32768` → 6543 (pooler). UFW blocks both from public; Tailscale/Cloudflare unaffected.
- kong CPU 15.8% in one sample, 2.3% next — burst, not sustained. db 41% once, 0.24% next — transient (autovacuum). Not investigated further.

## Minimal service set

```
db  kong  auth  rest  storage
```

## Disable commands

Immediate, reversible (containers stop, data/volumes persist):

```bash
cd ~/pharmacy-supabase
docker compose stop studio meta realtime supavisor imgproxy functions
```

Re-enable: `docker compose up -d studio meta realtime supavisor imgproxy functions`.

Caveat: any full `docker compose up -d` later restarts stopped services. For permanence, comment out the 6 services in `docker-compose.yml`, **and** remove `imgproxy` from `storage`'s `depends_on` (storage otherwise pulls imgproxy up with it). If studio is removed permanently, remove `studio` from `kong`'s `depends_on` too.

## Expected savings

- ~820MB RAM: stack 1.65GB → ~830MB. Host available RAM 1.6GB → ~2.4GB.
- ~15 idle DB connections freed (realtime 5, supavisor 7, cluster nodes 4).
- Two idle BEAM pollers (realtime, supavisor) and their CPU wakeups removed.
- `0.0.0.0:5433` listener disappears.

## Risks / notes

- **Data loss: none.** Volumes (`volumes/db/data`, `volumes/storage`, `deno-cache`) persist; stopping keeps data. Realtime `_realtime` schema, pooler `_supabase` db stay in place.
- **imgproxy**: storage still runs; only image-transform requests (never used) would 502. Re-enable before any `?width=` usage.
- **realtime**: if the web app later calls `.channel()`, start realtime again — schema intact.
- **studio**: loses browser DB admin until re-enabled. Confirm with owner it is not used manually.
- **watchtower**: does not restart stopped containers. Safe.
- **Uncertain**: storage shows 0 traffic in the 24h window; usage inferred from code (`getPublicUrl`) — storage is the one "required" service with no recent live traffic.

## Separate finding (not resource-related)

**SATUSEHAT queue has no scheduler.** `pg_cron` is preloaded in `shared_preload_libraries` but the extension is **not created** in any database — `cron.job` does not exist in `postgres`, `supabase`, or `_supabase`. `pg_net` IS installed (schema `net`, `http_request_queue` empty). The single SENT submission (2026-08-06 17:41) was dispatched manually during E2E. **No job polls `/api/satusehat/process-queue` — new PAID sales stay PENDING forever.** Fix later, in DB: `CREATE EXTENSION pg_cron` + `cron.schedule(...)` calling `net.http_post` with `x-cron-secret` header, or a web-side timer. Not blocked by this audit; requires `pg_cron` extension creation (superuser, in `supabase` db).
