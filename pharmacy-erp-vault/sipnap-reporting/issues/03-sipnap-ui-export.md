# 03 SIPNAP UI and export

Type: task
Status: resolved
Blocked by: 01, 02

## Answer

Use an **Inbox / Action** screen.

Flow:
1. APJ picks month and year.
2. Screen computes validation.
3. If errors exist, show a to-do list of broken transactions with quick-links to edit metadata.
4. If zero errors, show only a high-level summary: Total Items, Total In, Total Out.
5. Show one giant `Download Export` button only when the month is clean.
6. Do not render the full 500-row data grid in the browser.

Role gate: APJ only.

## Question

What minimal UI and export flow should `/reports/sipnap` ship in v1?

Need answer for:
1. Validation table layout
2. Export button state
3. Period picker behavior
4. File download behavior
5. Any role gate
