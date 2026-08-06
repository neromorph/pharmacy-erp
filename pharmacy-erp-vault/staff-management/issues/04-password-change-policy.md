# 04 Password change policy

Type: grilling
Status: resolved
Blocked by: none

## Answer

To streamline onboarding for cashiers and inventory staff:

1. **Onboarding / Creation**:
   - The Owner creates the user account with a temporary password (e.g. `TempPass123!`).
   - The user can log in and immediately start working on the POS/procurement screens. No forced password resets on first login.

2. **Self-Service Password Updates**:
   - We will add a "Change Password" tab to the User Profile/Settings screen (visible to any logged-in user).
   - This screen allows a staff member to input their current password and set a new password.
   - It triggers standard Client-side password updates via Supabase Auth:
     `supabase.auth.updateUser({ password: newPassword })`

3. **Owner Overwrite**:
   - If a user forgets their password, they notify the Owner.
   - The Owner can open the staff detail modal and enter a new password.
   - This runs a Server Action wrapping the Supabase Admin Auth API:
     `supabase.auth.admin.updateUserById(userId, { password: newPassword })`
   - This allows instant shift unlocking without waiting for email deliveries.

## Question

Do users need to change their passwords immediately on first login? How do they update their passwords?
