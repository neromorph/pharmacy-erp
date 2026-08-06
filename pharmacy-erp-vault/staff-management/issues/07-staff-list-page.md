# 07 Staff list page

Type: task
Status: open
Blocked by: 06-server-actions.md

## Question

How do we design and implement the Staff Management tab under `/settings`?

Need answer for:
1. Location of the view (e.g. `/settings` tab page or modal).
2. Layout: A compact, clinical, high-contrast table showing staff email, name, role badge, and active status.
3. Creation Modal: Form fields for Name, Email, Role (select: PHARMACIST, INVENTORY, CASHIER), and Password.
4. Action Options:
   - For other staff: edit role dropdown/select, toggle active state button, "Reset Password" button.
   - For self: disabled action buttons or hidden options (cannot edit self role/deactivate).
5. State feedback: toast alerts for successful creation, password change, deactivation, and validation errors.
