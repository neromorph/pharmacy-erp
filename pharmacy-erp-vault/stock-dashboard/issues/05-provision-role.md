# 05 Provision role in app_metadata

Type: grilling
Status: open

Blocked by: 02

## Question

How does the app know a user's role (CASHIER / INVENTORY / PHARMACIST / OWNER) so opname approval can be gated?

`scripts/provision-tenant.ts` currently writes only `tenant_id` into `app_metadata`. The stock-opname approval rule (02) needs a role.

- Add a `role` claim to `app_metadata` at provisioning time? What default role for newly created users?
- How does the web server client read it — `user.app_metadata.role`?
- Are the four canonical roles the fixed set, or should role become a free value?

Resolve the field name, the accepted values, and the default.