# ADR 0002: FEFO Is Primary Stock Rule

## Status

Accepted

## Context

Pharmacy stock must respect expiry dates. Some items need strict expiry-based picking, but the business also needs flexibility for exceptions.

## Decision

Use FEFO as the primary stock allocation rule.

## Consequences

- Stock picking prefers batches with the earliest expiry date.
- The system still allows controlled exceptions when needed.
- Batch and expiry tracking are required from day 1.
