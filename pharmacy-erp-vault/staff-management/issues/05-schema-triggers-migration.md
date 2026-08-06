# 05 Schema and triggers migration

Type: task
Status: open
Blocked by: none

## Question

How do we write the migration script to set up the `public.staff` table, triggers on `auth.users`, and populate existing users?

Need answer for:
1. Migration file name and location.
2. Structure of the trigger function to capture raw app and user metadata during inserts/updates.
3. Constraint to prevent users from deactivating/demoting themselves at the database level.
4. Backfill script for current auth.users rows to populate public.staff.
5. RLS policies allowing all tenant members to read staff list, but only Owners to modify.
