# Domain docs

This repo uses a **single-context** domain layout. All markdown files live in the `pharmacy-erp-vault/` Obsidian vault.

- `CONTEXT.md` in the vault holds the shared vocabulary and UI design reference.
- Architectural decision records live in two places: project ADRs (0001–0005) in the vault `adr/`; new ADRs go to the Obsidian second brain at `/Users/mufid/pintar/pintar/ADR/` as `ADR-NNN <Title>.md`. Lessons Learned RCAs live in the second brain `Lessons Learned/`.
- Progress, next steps, and infrastructure knowledge live in `AGENTS.md` at the repo root.

## Consumer rules

- Read `CONTEXT.md` before reading code or building features. It defines the domain terms the code uses.
- Follow the ASD-STE100 Simplified Technical English rule: short sentences, controlled vocabulary, one meaning per word.
- Vocabulary is the single source of truth for term meaning. If a term is ambiguous, fix `CONTEXT.md`, do not guess in code.

## Cross-references

- `CONTEXT.md` — domain vocabulary and UI reference
- `adr/` — project ADRs (0001–0005, historical). New ADRs: second brain `/Users/mufid/pintar/pintar/ADR/`
- `AGENTS.md` — operational state, progress, next plan, infra knowledge
- `supabase-deployment.md` — deep deployment/infra details