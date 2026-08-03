# Domain docs

This repo uses a **single-context** domain layout.

- `CONTEXT.md` at the repo root holds the shared vocabulary and UI design reference.
- Architectural decision records live in `docs/adr/`.
- Progress, next steps, and infrastructure knowledge live in `AGENTS.md` at the repo root.

## Consumer rules

- Read `CONTEXT.md` before reading code or building features. It defines the domain terms the code uses.
- Follow the ASD-STE100 Simplified Technical English rule: short sentences, controlled vocabulary, one meaning per word.
- Vocabulary is the single source of truth for term meaning. If a term is ambiguous, fix `CONTEXT.md`, do not guess in code.

## Cross-references

- `CONTEXT.md` — domain vocabulary and UI reference
- `docs/adr/` — architectural decision records
- `AGENTS.md` — operational state, progress, next plan, infra knowledge
- `docs/supabase-deployment.md` — deep deployment/infra details