# Procurement receive polish

Type: task
Status: resolved

## Question

What changes make PO to receipt flow fast, obvious, and hard to misclick?

## Answer

Current procurement flow already exists. Main gap is receipt safety and entry speed.

Keep scope small for sellable v1:
- Show PO summary and receipt summary in one clear page.
- Prefill receipt fields from PO lines when possible.
- Add row-level validation for batch, expiry, qty, and cost before submit.
- Make submit action and destructive state changes very obvious.
- Keep current approve/receive split. Do not merge draft, approval, and receipt into one screen.
- Do not add barcode receive or mobile scan now.

Result: procurement stays simple, safe, and fast enough for daily use.
