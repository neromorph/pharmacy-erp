# 04 Receipt data wiring

Type: grilling
Status: resolved

## Question

Which fields flow onto the thermal receipt? How does the receipt pull store profile data (name, SIA, SIPA, logo, address) from `tenants`? What happens when profile fields are empty (go-live before settings are filled in)? Is there a receipt-footer / return-policy text field?

## Answer

Grilled with user, five decisions:
1. **Source of truth** — use `tenants` only.
2. **Footer / return policy** — free text on `tenants.receipt_footer`.
3. **Header** — store name, address, phone, SIA/SIPA, logo.
4. **Body** — invoice no, date/time, cashier, line items, subtotal, discount, tax, total, payment method.
5. **Payment print rule** — one primary method + change; rare split pay prints `SPLIT` / `MULTI` and total paid, not full tender rows. Footer prints by default and hides when empty.