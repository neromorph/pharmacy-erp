# Audit trail + sensitive-action logs

Type: task
Status: resolved

## Question

What sensitive actions must show who did what and when for buyer trust in sellable v1?

## Answer

Current app already stores some actor fields on sensitive flows. Buyer trust gap is mostly display and consistency.

Keep scope small for sellable v1:
- Show actor + timestamp on PO submit, PO approve, receipt, stock opname submit, stock opname approve, destruction create, sale void, and settings changes.
- Prefer existing created_by / approved_by / updated_at fields. Do not add a new audit subsystem now.
- Show audit data in detail screens and list rows where it matters.
- Use human-readable names where available, not only IDs.
- Make destructive actions and approvals obvious in UI.

Result: buyer can see who changed stock, procurement, or finance state and when.
