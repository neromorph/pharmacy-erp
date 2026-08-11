# POS speed + keyboard flow

Type: task
Status: resolved

## Question

What UI and interaction changes make cashier sale flow fast enough for sellable v1? Focus on scan-first input, keyboard shortcuts, and fewer clicks.

## Answer

Current POS has core sale logic already. Main gap is operator speed in UI.

Keep scope small for sellable v1:
- Add barcode-first item entry on sales form.
- Add keyboard shortcuts for add item, add racikan, submit, and cancel.
- Auto-focus first empty field after row add.
- Reduce table scan clutter on new sale page.
- Add quick search / typeahead for product picker.
- Keep current validation and BPJS / resep gates.

Do not add new POS engine. Do not add offline mode now. Do not add custom shortcut system per role yet.

Result: cashier flow can stay inside one screen with fewer clicks and less mouse use.
