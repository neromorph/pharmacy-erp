# 02 Stock opname and adjustment flow

Type: grilling
Status: open

Blocked by: 01

## Question

How should a physical stock count and change against `product_batches.current_qty`?

- When a stock opname finds a batch that differs from the system count, how is the difference recorded?
- What is the adjustment record — a new table, or a direct update of `current_qty` with a reason?
- Who may run a stock opname or make an adjustment: Owner/Pharmacist only, or also Inventory/Purchasing?
- Does an adjustment need approval like a PO, or is it immediate?

Resolve a concrete flow: trigger, actor, record shape, and effect on stock.