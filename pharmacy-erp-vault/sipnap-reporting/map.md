# Map: SIPNAP Reporting

## Destination

Build SIPNAP compliance reporting for pharmacy sales. v1 shows a validation screen, then exports monthly report data for Narkotika and Psikotropika sales.

## Notes

- **Tracker**: this vault. Format per `pharmacy-erp-vault/agents/issue-tracker.md`.
- **Domain**: pharmacy compliance follow-up for clinical sales. Read `CONTEXT.md`, `AGENTS.md`, `commercial-core/map.md`, and `resep-dokter/map.md` first. ASD-STE100 in all output.
- **Scope lock**: v1 is validation screen + export only. No archive screen, no backend scheduler, no multi-branch.
- **Users**: APJ, owner, compliance staff.
- **Data already in place**: `products.regulatory_category`, `sales.sale_type`, `doctors.sip_number`, `patients.address`.

## Decisions so far

- [SIPNAP column set](issues/01-sipnap-export-format.md) — one monthly export file; v1 covers Narkotika and Psikotropika; rows use Product Name plus Saldo Awal / Pemasukan / Pengeluaran / Status Pemusnahan / Saldo Akhir.
- [SIPNAP validation rules](issues/02-sipnap-validation-rules.md) — hard block export when any required doctor or patient field is missing; show a to-do list of broken transactions and quick-links to fix them.
- [SIPNAP UI shape](issues/03-sipnap-ui-export.md) — month picker + validation inbox; no 500-row grid; giant Download Export button unlocks only when zero errors.
- [SIPNAP export lock](issues/04-sipnap-export-lock.md) — export stays idempotent and read-only; save one `sipnap_exports` audit row with month, year, generated_at, and counts/hash.

## Not yet specified

- Exact row filter for Ready vs Missing Data.
- Exact export format and file name.
- Which fields block export and which only warn.
- Exact screen layout for validation table.

## Out of scope

- Monthly archive screen.
- Background scheduler.
- Purchase returns.
- Multi-branch.
- SATUSEHAT.
- BPJS/JKN.
