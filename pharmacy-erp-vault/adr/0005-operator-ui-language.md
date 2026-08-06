# ADR 0005: Operator UI is English, customer documents are Indonesian

Status: Accepted
Date: 2026-08-06

## Context

The interface review of the POS flow found mixed interface language: English operator chrome ("Complete Sale", "Void Sale") beside Indonesian buttons ("Cetak Struk"). `CONTEXT.md` vocabulary is English (FEFO, Batch, Goods Receipt). Receipts are fully Indonesian because the customer receives them.

## Decision

1. Operator-facing chrome (nav, buttons, forms, errors, page titles) is English.
2. Customer-facing documents (receipt body) are Indonesian.
3. New copy follows this split. A mixed-language screen is a defect.

## Consequences

- One vocabulary per surface. Future copy reviews have a rule to check against.
- The receipt screen preview controls ("Print receipt", "Back to sale detail") are English; the printed receipt body stays Indonesian.
