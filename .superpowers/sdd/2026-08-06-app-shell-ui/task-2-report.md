# Task 2 report — Foundation: Tailwind v4 + shadcn/ui + lucide-react

Status: DONE

## What was done

Installed the full styling foundation in `apps/web` per the task brief:

1. **Deps installed @latest**: `tailwindcss@4.3.3`, `@tailwindcss/postcss@4.3.3`, `lucide-react@1.28.0`. `pnpm update --latest` bumped `next 16.2.12 → 16.3.0`, `@supabase/supabase-js 2.111 → 2.112.1`. `typescript` auto-bumped to `7.0.2` → reverted to `^6.0.3` per binding constraint (TS 7 breaks Next 16 + ts-jest). No other existing dep moved.
2. **`postcss.config.mjs`** created: `{ plugins: { '@tailwindcss/postcss': {} } }` (Tailwind v4, CSS-first, no tailwind.config.js).
3. **`apps/web/tsconfig.json`**: added `paths: { "@/*": ["./*"] }`. `baseUrl` was tried first but TS 6.0.3 errors `TS5101` (deprecated, removed in TS 7) — dropped it; `paths` without `baseUrl` resolves relative to the tsconfig file, which works.
4. **`app/globals.css` rewritten**: `@import "tailwindcss"` + `@theme` with `--color-primary: #0d9488`, `--color-primary-hover: #0f766e`, `--color-primary-foreground: #fff`; `@theme inline` bridge for legacy vars; `:root` keeps all 9 legacy vars (audited: pages use `var(--primary|hover|surface|card|text-primary|text-secondary|border|success|warning|danger)`); html font stack Inter/system; body font-size 14px.
   - shadcn init appended its own theme block (shadcn/tailwind.css import, `tw-animate-css`, oklch semantic vars, `.dark` block, `@layer base`). It clobbered `--primary` to neutral black — I restored `#0d9488` (teal binding). The `@layer base` body rules (bg-background text-foreground) come after Tailwind preflight; root layout body class `bg-slate-50 text-slate-900` also applies. No dark-mode work done (block is dormant, no `.dark` class ever added).
   - **Preserved for receipts**: audit showed the receipt thermal/print CSS is NOT in globals.css — it is injected inline in `app/(print)/receipts/[saleId]/page.tsx` via `receiptCss()` (scoped `.receipt-print`, `@media print`, `?w=58/80`). Nothing in old globals.css was print-related; only vars + fonts carried over. Receipt page file untouched (9 matches for receiptCss/receipt-print/@media print confirmed intact). Tailwind preflight risk: page uses inline styles everywhere, so preflight resets don't affect it; visibility-based print CSS is independent of preflight. Re-verified visually at Task 8.
5. **shadcn init + add**: `pnpm dlx shadcn@latest init -y -d` — style `base-nova` (latest registry style, uses `@base-ui/react` Base UI), rsc true, baseColor neutral, cssVariables true, iconLibrary lucide. Hand-written `components/ui/button.tsx` deleted first; generated Button replaced it (uses `bg-primary` → teal). Added: button input label card badge table dialog sheet select textarea skeleton separator (11 files). `lib/utils.ts` created with `cn()` (clsx + tailwind-merge). `components.json` written with aliases `ui: @/components/ui`, `lib: @/lib`, css `app/globals.css`.
6. **Root layout**: set `<body className="bg-slate-50 text-slate-900 antialiased">`. Also removed the Geist font injection that shadcn init added to layout.tsx (approved design = system fonts, no font loading).

## Commands + output

- `pnpm add -D tailwindcss@latest @tailwindcss/postcss@latest` → done (12 packages)
- `pnpm add lucide-react@latest` → done
- `pnpm update --latest` → bumped next + supabase-js; typescript 7.0.2 → reverted
- `pnpm add -D typescript@^6.0.3` → back to ^6.0.3
- `pnpm dlx shadcn@latest init -y -d` → wrote components.json, created button.tsx + lib/utils.ts, updated globals.css + layout.tsx
- `pnpm dlx shadcn@latest add button input label card badge table dialog sheet select textarea skeleton separator` → 11 files created, button skipped (identical)
- `npx next build` → Compiled successfully, 26 static pages, route table unchanged (no (app)/(auth)/(print) segments; /login static)
- `npx vitest run` → 12 files, 85/85 passed
- `pnpm -r lint` → domain/api/web all Done (web = tsc --noEmit)
- `git commit` → pre-commit hook ran lint + build + audit + trivy, all green

## Resolved package versions

New (apps/web):
- tailwindcss ^4.3.3
- @tailwindcss/postcss ^4.3.3
- lucide-react ^1.28.0
- @base-ui/react ^1.7.0 (shadcn base-nova)
- class-variance-authority ^0.7.1, clsx ^2.1.1, tailwind-merge ^3.6.0, tw-animate-css ^1.4.0, shadcn ^4.16.1 (CLI + tailwind theme import)

Bumped existing (via update --latest):
- next ^16.2.12 → ^16.3.0
- @supabase/supabase-js ^2.111.0 → ^2.112.1
- typescript: ^6.0.3 → (7.0.2) → ^6.0.3 (reverted, binding)

Unchanged: react ^19.2.8, react-dom ^19.2.8, @supabase/ssr ^0.12.4, @types/* , vitest ^4.1.10.

## Which old globals.css rules were preserved

- All 9 legacy CSS vars (`--primary` #0d9488, `--primary-hover` #0f766e, `--surface`, `--card`, `--text-primary`, `--text-secondary`, `--border`, `--success`, `--warning`, `--danger`) kept in `:root` + bridged via `@theme inline` so existing inline-style pages keep working.
- Font stack Inter/system-ui/sans-serif on html.
- Dropped per brief: `main { padding: 2rem }` (layouts own padding in Tasks 3-7), element `body` styles (now Tailwind utilities).
- No print/thermal rules existed in globals.css (they live inline in the receipt page) — nothing to lose; receipt page untouched and confirmed intact.

## Verification

- `npx next build` green (26 routes, route table identical to pre-change)
- `npx vitest run` 85/85 green
- `pnpm -r lint` green (3 workspaces)
- Pre-commit hook passed on the commit (lint + build + audit + trivy)
- `git status` clean after commit
- grep confirmed receipt page still has `receiptCss`/`@media print`/`.receipt-print` (9 hits)

## Concerns

- `shadcn` ^4.16.1 landed in `dependencies` (not devDependencies) — the CLI put it there; it provides the `shadcn/tailwind.css` theme import used by globals.css, so it is a runtime dependency of the stylesheet. Acceptable.
- Tailwind preflight now resets element styles globally. Pages with bare `<table>`/`<button>`/`<h1>` markup (not yet restyled, Tasks 4-7) may look slightly different until restyled. Receipts unaffected (inline styles).
- The `middleware` deprecation warning is pre-existing (Next 16 suggests `proxy`) — unrelated to this task.
- `@theme inline` in the shadcn block maps `--color-primary` to `var(--primary)`; the `:root` `--primary` is now `#0d9488`, so shadcn Button renders teal as required.
