# 03 Self modification prevention

Type: grilling
Status: resolved
Blocked by: none

## Answer

To prevent the store Owner from accidentally locking themselves out of the system:

1. **Application Layer Checks**:
   - The UI details page and actions list will disable the "Deactivate" and "Change Role" buttons when viewing the current user's profile card.
   - The Server Actions that handle staff updates will explicitly compare the target user's ID with the logged-in caller's user ID (retrieved from `auth.uid()` or Server Client `getUser()`).
   - If they match, the action throws a validation error: `"You cannot modify your own role or active status."`

2. **Database Constraints (Trigger Guard)**:
   - A database `BEFORE UPDATE` trigger on `public.staff` will assert that `NEW.id <> auth.uid()` when changes are made to the `is_active` or `role` columns.
   - If an Owner attempts to bypass the application layer, the database transaction will abort, preventing any accidental role demotions or deactivations.

## Question

How do we prevent store Owners from accidentally deactivating their own accounts or demoting their roles?
