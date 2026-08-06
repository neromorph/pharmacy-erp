# 02 Aging report

Type: grilling
Status: resolved

## Answer

1. Buckets: Belum Jatuh Tempo (due date not passed), 1-30, 31-60, 61-90, >90 days past due (days = today − due_date).
2. Location: summary cards at the top of `/finance/payables`, above the invoice list. No separate route.
3. Export: CSV mandatory (client-side Blob, follows the SIPNAP download pattern). CSV contains the open payable rows with a bucket column.
4. Count: all open (non-PAID) payables, including Belum Jatuh Tempo.

## Question

What should the aging report show?

Need answer for:
1. Bucket widths: 0-30 / 31-60 / 61-90 / 90+ days past due, or another split?
2. Where does it live: summary cards on `/finance/payables`, or a separate page?
3. Does the aging need to be exported (CSV), or is on-screen enough?
4. Should aging count only OVERDUE payables, or all open payables split by age since due date?
