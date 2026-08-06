### Task 2: Foundation — Tailwind v4 + shadcn + lucide setup

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/postcss.config.mjs`, `apps/web/components.json`
- Modify: `apps/web/tsconfig.json` (add alias)
- Rewrite: `apps/web/app/globals.css`
- Generate/replace: `apps/web/components/ui/*` (shadcn), `apps/web/lib/utils.ts` (cn helper)
- Modify: `apps/web/.env`-adjacent none. `pnpm-lock.yaml` updates via install.

- [ ] **Step 1: Install Tailwind v4 + PostCSS plugin.**

Run in `apps/web`:
```bash
pnpm add -D tailwindcss@latest @tailwindcss/postcss@latest
pnpm add lucide-react@latest
pnpm update --latest   # bump existing web deps; revert/downgrade only if build breaks and record it
```

- [ ] **Step 2: `apps/web/postcss.config.mjs`.**

Exact:
```javascript
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
```

- [ ] **Step 3: Add `@/*` alias to `apps/web/tsconfig.json`.**

Merge into `compilerOptions` (keep everything else):
```json
"baseUrl": ".",
"paths": {
  "@/*": ["./*"]
}
```

- [ ] **Step 4: Rewrite `apps/web/app/globals.css`.**

Content shape (audit the current file first; preserve anything receipts need — e.g. thermal print classes, `@media print` blocks — by copying it to the bottom of the new file):

```css
@import "tailwindcss";

@theme {
  --color-primary: #0d9488;        /* Teal-600 — project primary */
  --color-primary-hover: #0f766e;  /* Teal-700 */
  --color-primary-foreground: #ffffff;
}

/* Bridge old raw vars so leftover inline styles keep working during migration. */
@theme inline {
  --color-surface: var(--surface);
  --color-card: var(--card);
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-border: var(--border);
}

:root {
  --surface: #f8fafc;
  --card: #ffffff;
  --text-primary: #0f172a;
  --text-secondary: #64748b;
  --border: #e2e8f0;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
}

html {
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}

/* …preserve: existing table defaults, receipt thermal/print CSS, @media print blocks… */
```

Rules: no dark-mode work; drop the old `main { padding: 2rem }` global (layouts own padding now); keep `body` base background `bg-slate-50` via class on body in root layout instead of element selector.

- [ ] **Step 5: shadcn init + add components.**

In `apps/web`:
```bash
pnpm dlx shadcn@latest init -y -d   # -d defaults: new-york, slate base, CSS variables on
pnpm dlx shadcn@latest add button input label card badge table dialog sheet select textarea skeleton separator
```
If `init` is interactive or refuses (existing components/ui/button.tsx), delete that file first — it is replaced by the generated version. Ensure `components.json` `tailwind.css` points at `app/globals.css` and `aliases.ui` = `@/components/ui`, `aliases.lib` = `@/lib`. Verify `apps/web/lib/utils.ts` now exports `cn`.

- [ ] **Step 6: Root layout body class** — in `apps/web/app/layout.tsx` set `<body className="bg-slate-50 text-slate-900 antialiased">` (body stays the only html shell here; group layouts add their own wrappers).

- [ ] **Step 7: Verify.**

`cd apps/web && npx next build` green; `npx vitest run` 85/85; `pnpm -r lint` green (tsc). `git diff` shows no page file changes (visual restyle comes later). Receipts print CSS preserved (grep for `@media print` and thermal classes in the new globals.css).

- [ ] **Step 8: Commit.**

`feat(web): add Tailwind v4 + shadcn/ui + lucide-react foundation`

---

