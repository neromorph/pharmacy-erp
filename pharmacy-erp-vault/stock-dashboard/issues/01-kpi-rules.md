# 01 Define the three KPI rules

Type: grilling
Status: open

## Question

What are the exact calculation rules for the dashboard's three KPIs?

- Near-expiry: how many days before expiry counts as "near"? A sliding threshold or a fixed window (e.g. 30 days)?
- Low stock: is a product low when `sum(product_batches.current_qty)` is below `products.min_stock_level`? What about products with no batch rows?
- Daily sales: is "daily" the current calendar day (branch local timezone), counted from PAID sales only? Currency is IDR throughout.

Resolve each with a concrete rule the query layer can implement. Give one number or rule per KPI, not a range.