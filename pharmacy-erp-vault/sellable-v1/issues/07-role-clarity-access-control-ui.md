# Role clarity + access control UI

Type: task
Status: resolved

## Question

What UI changes make allowed actions obvious for each role without guesswork?

## Answer

Current app already shows role badge in header and blocks some pages by role. Gap is clarity at action level.

Keep scope small for sellable v1:
- Show role badge and short permission hint near action groups.
- Disable or hide actions the role cannot run, with one-line reason.
- Keep OWNER-only pages explicit in list and empty states.
- Use existing role checks. Do not add a full permissions matrix UI now.
- Make approval actions and restricted settings obvious in detail pages.

Result: user knows what they can do before they click.
