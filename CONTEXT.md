# Context

## Terms

- **Tenant**: one pharmacy store branch. Day 1 isolation boundary.
- **User**: one staff account belongs to exactly one tenant.
- **Owner**: tenant admin with full access.
- **Pharmacist/Admin**: manages products, sales, purchasing, stock, and reports.
- **Cashier**: runs POS and sees own shift sales history.
- **Inventory/Purchasing**: manages procurement, receiving, stock opname, and stock adjustments.
- **Product**: sellable item with one or more sales units.
- **Product Unit**: a selling multiplier of the base unit (e.g., Box = 30 tablets). Holds the barcode and price.
- **Batch**: stock lot with expiry date and source record. Stock quantity is strictly held at the batch level in base units.
- **FEFO**: stock allocation rule using earliest expiry first.
- **Purchase Order (PO)**: request to supplier/PBF. Has a status: DRAFT, PENDING_APPROVAL, APPROVED, RECEIVED, CANCELLED.
- **Supplier**: external entity a PO is sent to. Technical model name; shown as **PBF** in the UI. Has `is_pbf`, `pbf_license_number`, `payment_terms_days`.
- **Goods Receipt**: receiving event that records invoice, batch, expiry date, and stock increase. On receipt, one `product_batches` row is created per item (FEFO entry point) and the PO becomes RECEIVED.
- **Stock Opname**: physical stock count plus system adjustment.
- **Sale**: POS transaction.
- **Prescription Tag**: lightweight marker for prescription-related sale context.

## Day 1 scope

- POS
- Procurement
- Stock
- OTC retail first
- Light prescription tracking

## Rules

- One tenant = one branch.
- One user = one tenant.
- FEFO is the primary stock rule.
- Supplier is the technical model name; PBF is the UI label.
- Dashboard shows only 3 KPIs on day 1.
- PO approval is 1-step conditional: Owner/Pharmacist direct-approve; Inventory/Purchasing requires approval.

## UI reference

### Design system

- Clean clinical enterprise UI for healthcare, pharmacy, and retail POS.
- Light-first, data-dense, compact, high-contrast layout for fast pharmacy work.
- Trustworthy Emerald/Teal primary, Slate neutrals, vivid status colors for stock and expiry alerts.

### Color tokens

- Primary: `#0D9488` (`Teal-600`)
- Primary hover: `#0F766E` (`Teal-700`)
- Surface background: `#F8FAFC` (`Slate-50`)
- Card surface: `#FFFFFF`
- Text primary: `#0F172A` (`Slate-900`)
- Text secondary: `#64748B` (`Slate-500`)
- Border/divider: `#E2E8F0` (`Slate-200`)
- Success: `#10B981` (`Emerald-500`)
- Warning: `#F59E0B` (`Amber-500`)
- Danger: `#EF4444` (`Red-500`)

### Typography

- Sans: Inter, Geist, or Plus Jakarta Sans
- Mono: JetBrains Mono or Geist Mono with tabular numbers
- Dense scale: 11px / 12px / 14px / 16px / 20px / 24px+

### Spacing

- Compact grid: 4px / 8px baseline
- Prefer `p-2`, `p-3`, `gap-3`
- Avoid wide spacing on POS and stock screens

### Components

- Primary buttons use `#0D9488`
- Secondary buttons use subtle outline on white
- Tables: bordered, zebra-hover, compact rows, sticky headers, right-aligned money
- Badges: batch numbers, expiry status, role tags

### Anti-patterns

- No pure dark theme for checkout or operational screens
- No low-contrast gray text for dosages or prices
- No slow transitions above 200ms on POS scanning
