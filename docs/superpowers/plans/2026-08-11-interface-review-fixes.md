# Interface Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four confirmed interface findings in the authenticated pharmacy shell.

**Architecture:** Keep changes local to the current app shell and shared control modules. The header owns visible Shift state and motion preference behavior. The root layout owns document language. Shared Button and Badge modules own their transition property lists.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Tailwind CSS v4, base-ui, Vitest.

## Global Constraints

- Change only the four approved findings.
- Use Indonesian operator copy and `lang="id"`.
- Do not add dependencies, modules, or a global motion token.
- Keep existing keyboard focus styles.
- Keep Shift fallback text unchanged.
- Use ASD-STE100 Simplified Technical English in code comments and commits.

---

## File Structure

- Modify: `apps/web/components/shell/TopHeader.tsx` — visible Shift label at every width and motion-safe pulse.
- Modify: `apps/web/app/layout.tsx` — Indonesian document language.
- Modify: `apps/web/components/ui/button.tsx` — exact Button transition properties.
- Modify: `apps/web/components/ui/badge.tsx` — exact Badge transition properties.

### Task 1: Fix header Shift state and document language

**Files:**
- Modify: `apps/web/components/shell/TopHeader.tsx:56-66`
- Modify: `apps/web/app/layout.tsx:14`

**Interfaces:**
- Consumes: `ShiftStatus` with `open: boolean` and `openedAt: string | null`.
- Produces: Header text `Shift Aktif · HH:MM` or `Tidak ada shift aktif` at every viewport width.

- [ ] **Step 1: Inspect current header and root layout**

Run:

```bash
nl -ba apps/web/components/shell/TopHeader.tsx | sed -n '55,68p'
nl -ba apps/web/app/layout.tsx | sed -n '12,16p'
```

Expected: Shift label has `hidden ... sm:inline`, open dot has `animate-pulse`, and root HTML has `lang="en"`.

- [ ] **Step 2: Apply minimal header and language change**

In `TopHeader.tsx`, replace the open dot class and Shift label class with:

```tsx
shift.open
  ? 'size-2 motion-safe:animate-pulse rounded-full bg-emerald-500'
  : 'size-2 rounded-full bg-slate-300'

<span className="text-xs text-slate-500">
  {shift.open ? `Shift Aktif · ${opened ?? ''}` : 'Tidak ada shift aktif'}
</span>
```

In `app/layout.tsx`, replace the root element with:

```tsx
<html lang="id" className={inter.variable}>
```

- [ ] **Step 3: Type-check the changed modules**

Run:

```bash
pnpm --filter @pharmacy/web lint
```

Expected: exit code 0.

- [ ] **Step 4: Verify rendered critical states**

Open the authenticated app at a narrow viewport. Confirm the Shift text remains visible. Enable reduced motion in the browser or OS. Confirm the open Shift dot remains Emerald but does not pulse. Tab to the mobile menu button. Confirm focus remains visible.

Expected: all three checks pass.

- [ ] **Step 5: Commit Task 1**

```bash
git add apps/web/components/shell/TopHeader.tsx apps/web/app/layout.tsx
git commit -m "fix: show shift state on mobile"
```

### Task 2: Narrow shared control transitions

**Files:**
- Modify: `apps/web/components/ui/button.tsx:7`
- Modify: `apps/web/components/ui/badge.tsx:8`

**Interfaces:**
- Consumes: existing Tailwind variants and base-ui control props.
- Produces: Button and Badge transitions limited to their visual state properties; no interface or behavior change.

- [ ] **Step 1: Inspect shared transition declarations**

Run:

```bash
grep -n "transition-all" apps/web/components/ui/button.tsx apps/web/components/ui/badge.tsx
```

Expected: one `transition-all` match in each file.

- [ ] **Step 2: Apply exact transition properties**

In `button.tsx`, replace `transition-all` with:

```text
transition-[color,background-color,border-color,box-shadow,transform]
```

In `badge.tsx`, replace `transition-all` with:

```text
transition-[color,background-color,border-color,box-shadow]
```

- [ ] **Step 3: Confirm broad transitions are removed**

Run:

```bash
! grep -n "transition-all" apps/web/components/ui/button.tsx apps/web/components/ui/badge.tsx
```

Expected: exit code 0 and no output.

- [ ] **Step 4: Run web checks**

Run:

```bash
pnpm --filter @pharmacy/web lint
pnpm --filter @pharmacy/web build
```

Expected: both commands exit code 0.

- [ ] **Step 5: Verify shared control states**

In the browser, use a Button and a Badge link or control. Confirm hover, active, and keyboard focus states render. Confirm no unrelated size or layout animation runs.

Expected: all checks pass.

- [ ] **Step 6: Commit Task 2**

```bash
git add apps/web/components/ui/button.tsx apps/web/components/ui/badge.tsx
git commit -m "fix: narrow control transitions"
```

## Final Verification

- [ ] **Step 1: Check final diff scope**

Run:

```bash
git diff HEAD~2..HEAD -- apps/web/components/shell/TopHeader.tsx apps/web/app/layout.tsx apps/web/components/ui/button.tsx apps/web/components/ui/badge.tsx
```

Expected: only approved Shift label, reduced-motion, document language, and transition changes.

- [ ] **Step 2: Run full workspace verification**

Run:

```bash
pnpm -r test
pnpm -r build
```

Expected: both commands exit code 0.
