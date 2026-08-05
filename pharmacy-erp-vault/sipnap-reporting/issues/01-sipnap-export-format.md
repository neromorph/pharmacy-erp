# 01 SIPNAP export format

Type: research
Status: claimed
Blocked by: none

## Answer

SIPNAP v1 should export **one monthly file per compliance run**.

- **Scope**: monthly, due by the 10th of next month.
- **Categories in v1**: Narkotika and Psikotropika. Keep OOT and Prekursor for later if the map stays narrow.
- **Rows**: one row per product per month is enough for v1.
- **Columns**: Product Name, Initial Stock (`Saldo Awal`), Incoming Qty (`Pemasukan`), Outgoing Qty (`Pengeluaran`), Destruction Status (`Status Pemusnahan`), Final Stock (`Saldo Akhir`).
- **Layout**: one file is enough. No need for one sheet per category in v1.
- **UI base set**: yes. Reuse the commercial-core SIPNAP column set as the validation and export base.

This keeps export simple and matches current vault notes.

## Question

What column set and scope should SIPNAP v1 export use for this pharmacy?

Need answer for:
1. Monthly scope rules
2. Which drug categories go in v1
3. Required columns for each row
4. Whether the export is one file or one sheet per category
5. Whether `Saldo Awal / Pemasukan / Pengeluaran / Status Pemusnahan / Saldo Akhir` is the right base set for the UI
