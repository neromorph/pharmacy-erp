# Map: Staff Management

## Destination

Provide an OWNER-gated user management interface and database structure to manage employee accounts, roles (`OWNER`, `PHARMACIST`, `INVENTORY`, `CASHIER`), and active statuses. Includes synchronization from Supabase `auth.users` to a tenant-scoped `public.staff` table, deactivation via Auth Admin API + RLS, and owner-initiated password resets.

## Notes

- **Tracker**: this vault. Format per `pharmacy-erp-vault/agents/issue-tracker.md`.
- **Domain**: access control, staff roster, authorization gates. Read `CONTEXT.md`, `AGENTS.md`. ASD-STE100 in all output.
- **Scope lock**: Owner-only management interface. No self-service password reset email setup (uses owner overwrite). No multi-tenant cross-branch role assignments.
- **Users**: Store Owner.

## Decisions so far

- [Public staff table](issues/01-public-staff-table.md) — Mirror `auth.users` inserts/updates to `public.staff` table via Postgres trigger. RLS on `public.staff` is tenant-scoped; only Owners can edit.
- [Deactivation mechanism](issues/02-deactivation-mechanism.md) — Toggling `is_active` to false calls Supabase Auth Admin API to ban the user indefinitely (Gateway block), and secondary RLS policies check status on critical write paths.
- [Self modification prevention](issues/03-self-modification-prevention.md) — Server actions and database triggers prevent users from updating their own roles or deactivating themselves.
- [Password change policy](issues/04-password-change-policy.md) — Optional password changes via Settings screen; no forced reset on first login.

## Not yet specified

<!-- all current fog graduated to tickets 05-08 -->

## Out of scope

- Self-service email password recovery flow (requires SMTP).
- Custom permission levels per-endpoint (keeps to role-based access).
- Multi-branch staff assignment (one staff belongs to exactly one tenant).
