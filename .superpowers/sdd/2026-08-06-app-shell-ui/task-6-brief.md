### Task 6: Restyle Procurement pages

**Pages:** `(app)/suppliers/page.tsx` + `/[id]`, `(app)/procurement/page.tsx` + `/new` + `/[id]` + `/[id]/receive`, `(app)/procurement/returns/page.tsx` + `/new` + `/[id]`.

- [ ] **Steps:** same playbook; PO status machine pills map DRAFT→outline, PENDING_APPROVAL→secondary, APPROVED→default, RECEIVED→secondary, CANCELLED→destructive; receive page qty inputs compact `w-24`. Tests + build + lint green. Commit `style(web): Tailwind+shadcn restyle for procurement pages`.

