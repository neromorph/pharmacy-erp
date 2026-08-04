# 03 Shift POS blocking rule

Type: grilling
Status: resolved

## Question

What is the exact rule when a cashier has no open shift? Must the POS block sale creation entirely, or allow draft carts and block only payment? How is a mid-shift staff change (cashier swap) handled, and what happens to a draft sale when the shift closes?

## Answer

Grilled with user, five decisions:
1. **No open shift** — hard block. POS cannot create sale.
2. **Shift ownership** — one shift per cashier. One user owns one shift.
3. **Opening cash** — required on shift open.
4. **Draft sale** — block shift close until all drafts are paid or canceled.
5. **Staff change** — close old shift, open new shift. No transfer of active shift ownership.