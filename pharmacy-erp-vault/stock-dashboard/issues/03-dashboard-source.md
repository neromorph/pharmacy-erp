# 03 Dashboard data source and day boundary

Type: grilling
Status: open

Blocked by: 01

## Question

Where does the dashboard read its three KPIs, and how is "daily" defined?

- Source: a server-component query each render, or a cached/home-made aggregate stored on write? Keep it consistent with the direct-Supabase server-client pattern.
- Day boundary for "daily sales": branch local calendar day (WIB, UTC+7)? Or another convention?
- KPI numbers: exact counts/amounts per rule in 01 — total daily sales amount, low-stock product count, near-expiry batch count.

Resolve the data source and the three numbers to render.