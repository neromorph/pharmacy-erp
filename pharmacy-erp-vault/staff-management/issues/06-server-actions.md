# 06 Server actions

Type: task
Status: open
Blocked by: 05-schema-triggers-migration.md

## Question

How should the Next.js Server Actions interface with Supabase Auth Admin API and public.staff to manage users?

Need answer for:
1. File location for the actions (e.g. `apps/web/app/settings/staff-actions.ts`).
2. Action code for creating a user: `createStaffUser({ email, name, role, password })`. It must call `auth.admin.createUser()` with custom app_metadata (tenant_id + role) and user_metadata (name), then handle errors (like email already exists).
3. Action code for toggling active status: `toggleStaffActive({ userId, is_active })`. It must check that the caller is an OWNER, the target is not themselves, and call both `auth.admin.updateUserById(userId, { ban_duration: is_active ? 'none' : 'infinite' })` and update `public.staff` (trigger should handle mirror but explicit update ensures immediate consistency).
4. Action code for updating role: `updateStaffRole({ userId, role })`. Caller must be OWNER, target must not be themselves, call `auth.admin.updateUserById(userId, { app_metadata: { role } })`.
5. Action code for resetting password: `resetStaffPassword({ userId, newPassword })`. Caller must be OWNER, target must not be themselves (they can update their own password using standard client-side self-update), call `auth.admin.updateUserById(userId, { password: newPassword })`.
