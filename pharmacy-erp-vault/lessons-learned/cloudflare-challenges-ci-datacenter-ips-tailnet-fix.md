# Cloudflare Challenges CI Runner Datacenter IPs and Tailnet Fix

## Incident Summary
The integration test suite failed in GitHub Actions because API requests to `pharmacy-api.nmrooms.biz.id` returned `403` or HTML challenge pages. Cloudflare's managed bot protection challenged the GitHub runner's datacenter IP address.

## Root Cause
1. **Public API Routing:** The public Supabase Kong domain (`pharmacy-api.nmrooms.biz.id`) proxies through Cloudflare.
2. **Datacenter IP Trust Score:** Cloudflare challenges or blocks incoming traffic from public cloud provider IP ranges (GitHub Actions runners) to protect against scraping and automated abuse.
3. **Loopback Binding:** Supabase Kong on the VPS was bound to localhost (`127.0.0.1:8001`), making it inaccessible from outside the host without going through Cloudflare.

## Solution
1. **Bind Kong to Tailscale IP:** Changed `KONG_HTTP_PORT` in `~/pharmacy-supabase/.env` on the VPS to bind directly to the Tailscale IP (`100.119.164.5:8001`).
2. **Docker-User Firewall Rule:** Added an allowlist rule in `/etc/ufw/after.rules` (managed via `DOCKER-USER` chain) permitting tailnet range `100.64.0.0/10` to reach the container port `8000`.
   - *Gotcha:* The rule must match the **post-DNAT container port (8000)**, not the published host port (8001), because `DOCKER-USER` runs after the NAT table transforms the destination.
3. **CI Tailnet Connector:** Added the `tailscale/github-action` step to the CI workflow. The runner joins the tailnet and executes `bun run test:integration` against `http://100.119.164.5:8001`, completely bypassing Cloudflare.

## Lessons Learned
1. **Never use public Cloudflare-proxied endpoints for CI integration tests.** Datacenter IPs trigger bot challenges.
2. **Use private mesh VPN (Tailscale) for CI-to-VPS communication.**
3. **Remember DNAT ordering in iptables:** `DOCKER-USER` sees post-DNAT ports (container ports), not pre-DNAT published ports.
