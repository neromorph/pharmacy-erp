# Interface Review Fixes Design

## Scope

Fix four confirmed findings in the authenticated pharmacy shell. Do not change other flows.

## Changes

### Shift state

`TopHeader` always shows the shift label at all widths.

An open Shift keeps its Emerald dot. The pulse runs only when the user allows motion. A closed Shift keeps its Slate dot and label.

### Document language

The root HTML document uses `lang="id"` because operator-facing copy is Indonesian.

### Shared control transitions

The shared Button and Badge modules replace `transition-all` with exact transition properties. Button transitions color, border, shadow, and transform. Badge transitions color, border, and shadow.

## Error handling

No new data path or error mode exists. Current Shift fallback text remains unchanged.

## Testing

Run `pnpm --filter @pharmacy/web lint`.

Manual browser checks after implementation:

- At mobile width, Shift text remains visible.
- With reduced motion enabled, the open Shift dot does not pulse.
- Keyboard focus remains visible on Button and Badge controls.

## Exclusions

No global motion token, Shift module extraction, or unrelated interface work.
