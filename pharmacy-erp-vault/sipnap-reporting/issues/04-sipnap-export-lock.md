# 04 SIPNAP export lock

Type: task
Status: resolved
Blocked by: 02, 03

## Answer

Stay idempotent and read-only.

- Export may run many times.
- Do not freeze `voidSale`, `receiveGoods`, or `stock_opname` after export.
- Create one `sipnap_exports` audit row per run.
- Store `month`, `year`, `generated_at`, and summary counts or hash for audit.
- A later export may differ if source data changed. That is fine.

This keeps ops safe and keeps audit trace.

## Question

Should SIPNAP v1 freeze past data after export, or stay idempotent?

Decision lock:
- export is a read-only snapshot
- repeat export is allowed
- no retro lock on `voidSale`, `receiveGoods`, or `stock_opname`
- save `sipnap_exports` audit row with month, year, generated_at, and counts/hash

Need answer for:
1. Whether export creates an audit record
2. Which fields go into that record
3. Whether any ops block after export
4. Whether a later export can differ if source data changed
