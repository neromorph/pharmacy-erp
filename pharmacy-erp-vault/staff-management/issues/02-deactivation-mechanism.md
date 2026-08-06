# 02 Deactivation mechanism

Type: grilling
Status: resolved
Blocked by: none

## Answer

Employee deactivation will be implemented using a **Double Guard** pattern:

1. **Gateway Block (Auth Admin API)**:
   - When the Owner deactivates a user (sets `is_active = false`), the server action calls the Supabase Auth Admin API:
     `supabase.auth.admin.updateUserById(id, { ban_duration: 'infinite' })`
   - This invalidates the user's active session and prevents them from refreshing their JWT or logging in again.
   - When re-activating a user, `ban_duration` is reset to `none` (or `'0s'`).

2. **Database Block (Public Table + RLS)**:
   - The trigger on `auth.users` synchronizes the deactivation to `public.staff.is_active = false`.
   - Critical database write actions (e.g., POS payments, PO approvals, stock opname entries) contain checks to verify that the executing user's `is_active` flag in `public.staff` is `true`.
   - Read queries do not include this join to prevent performance degradation, relying on the Gateway Block to terminate active sessions within the JWT expiration window.

## Question

How do we block deactivated users from continuing to make requests with an active JWT?
