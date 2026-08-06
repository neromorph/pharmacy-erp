# 02 — Obtain SATUSEHAT sandbox credentials

Type: task
Status: resolved

## Question

The SATUSEHAT integration cannot be prototyped or tested until the dev/sandbox `client_id`, `client_secret`, and `org_id` are obtained from Kemenkes.

What must the human do to obtain them, and where should the result be stored?

## Steps (human-in-the-loop)

**Sandbox credentials are self-serve. No SIA number or approval needed. Takes ~5 minutes.**

1. Go to **`https://satusehat.kemkes.go.id/platform`** → click **Masuk**
2. Click **Daftar** → fill the "Buat Akun Portal Developer" form:
   - Use an institutional or team email (not personal)
   - Fill in the survey form → click **Buat Akun**
3. Activate the account via the email link sent to you
4. Log in → on the **Beranda** dashboard, switch the environment toggle (top-left) to **Sandbox**
5. In the sidebar click **Kode Akses API**
6. Copy **Organization ID**, **Client ID**, and **Client Secret** — displayed immediately, no approval required
7. Optional: click **Ubah Data** → set institution type to **Apotek**

Store in `apps/web/.env.local` (and `~/pharmacy-erp/.env` on the VPS):
```
SATUSEHAT_CLIENT_ID=...
SATUSEHAT_CLIENT_SECRET=...
SATUSEHAT_ORG_ID=...
SATUSEHAT_BASE_URL=https://api-satusehat-stg.dto.kemkes.go.id
```

Confirm when done. This unblocks live sandbox testing during implementation.

## Notes

- Production credentials require full fasyankes registration (SIA number, DFO/REGFASYANKES verification) — not needed for development.
- Old URL `platform.satusehat.kemkes.go.id` is dead; current URL is `satusehat.kemkes.go.id/platform`.

## Answer

Credentials obtained via Partner System (Penyedia Sistem RME) registration on `satusehat.kemkes.go.id/platform`. Stored in `apps/web/.env.local` (sandbox). Org ID, Client ID, Client Secret in place. `SATUSEHAT_BASE_URL` set to staging endpoint.
