# ADR 0001: Tenant Means One Branch

## Status

Accepted

## Context

Day 1 needs simple data isolation and simple operational boundaries. Each pharmacy branch has its own stock, cashier activity, and financial reports.

## Decision

Treat one tenant as one store branch.

## Consequences

- Every core record ties directly to `tenant_id`.
- No day-1 warehouse transfer logic.
- Future multi-branch consolidation can add a higher-level group entity later.
