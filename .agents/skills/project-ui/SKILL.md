---
name: project-ui
description: Create, update, or review this project's Electron renderer UI using shadcn components, the shared PageLayout, and section-based page composition.
---

# Project UI

Use these conventions for UI work in this repository. Read the sibling [shadcn skill](../shadcn/SKILL.md) for component discovery, installation, APIs, and styling rules. Preserve existing behavior while applying these guidelines to the UI being changed.

## Color direction

- Give the app a cohesive, muted color palette. Use softly tinted surfaces and subdued accent colors rather than defaulting to an entirely black-and-white interface.
- Define colors through the semantic theme tokens in `src/renderer/src/assets/main.css`, and use those tokens consistently in components. Avoid scattered hardcoded colors and overly saturated decoration.
- Keep text, controls, focus indicators, and status colors readable against tinted surfaces. Muted colors should retain clear contrast and hierarchy.

## Typography

- Use the bundled **Lora** serif font for headings and titles, and the bundled **Inter** sans-serif font for everything else: body copy, navigation, labels, buttons, inputs, tables, and status text.
- Use the shared `font-serif` and `font-sans` tokens rather than hardcoding font families in components. The base styles apply Lora to `h1`–`h6` and Inter to the body; use `font-serif` for a component title that cannot use a heading element.
- Keep font families consistent across all density presets; density changes font sizes and spacing, not the typefaces. Use the existing density-aware text-size tokens.
- Keep fonts local through the existing `@font-face` declarations in `src/renderer/src/assets/main.css`. Preserve the bundled font licenses and avoid runtime font downloads.

## Reuse before creating

- Use shadcn components wherever possible. Inspect `components.json`, existing usages, `src/renderer/src/components`, and the relevant renderer feature before choosing a component.
- Use the shared shadcn `ScrollArea` component for scrolling areas.
- Before creating a custom component, search the repository for a similar one and check the shadcn registry using the shadcn skill's workflow.
- If an existing component can reasonably support the use case, extend it with a backward-compatible prop or variant. Preserve current defaults, exports, and callers; inspect its references before changing its API.
- When a new component is needed, follow the existing shadcn conventions: typed React props, named exports, `cn()` for class merging, semantic theme tokens, accessible markup, and variants only where they serve a real need. Keep shared primitives in `components/ui`, layouts in `components/layouts`, and feature-specific components with their feature.

## App density

Use the app-wide **compact**, **balanced**, and **comfortable** presets defined in `src/renderer/src/assets/main.css`. Select one with `data-density` on the root `<html>` element; balanced is the default. Density is independent of light/dark mode and page width. Do not change the root font size to implement density.

- Use `gap-ui-xs`, `gap-ui-sm`, and `gap-ui-md` for density-aware spacing, `p-ui-md` for panel padding, and `py-page-y` for page vertical padding. Responsive page gutters use `px-ui-sm sm:px-ui-md lg:px-ui-lg` through `PageLayout`.
- Shared controls use `h-control` or `min-h-control`, `px-control-x` (or `px-control-icon-x`), and `py-control-y`. Button size variants use the corresponding `control-xs`, `control-sm`, and `control-lg` tokens.
- `text-xs`, `text-sm`, `text-base`, `text-3xl`, and `text-4xl` draw from density font tokens. Use them for supporting text, controls, body copy, page titles, and large headings as appropriate.
- Keep fixed dimensions where density should not affect them, such as icons, borders, and media aspect ratios. Add shared tokens for new repeated needs instead of per-component preset branches or arbitrary padding/font values.
- When changing density-aware UI, check all three presets for readable text, usable controls, and clipping in ordinary window sizes.

## Shared page layout

All route pages use `PageLayout` from `@/components/layouts/page-layout`. Its implementation is [page-layout.tsx](../../../src/renderer/src/components/layouts/page-layout.tsx).

- `width="default"` is the default: centered, `max-w-4xl`.
- `width="wide"` uses `max-w-7xl`.
- `width="full"` removes the maximum width while retaining horizontal padding.
- `padding="default"` uses responsive density-aware gutters: `px-ui-sm sm:px-ui-md lg:px-ui-lg`.
- `padding="compact"` uses `px-ui-sm`; it is a local gutter option, independent of the global density preset. `padding="none"` removes horizontal padding.
- Native div props and `className` are supported. Use `className` for local layout such as `flex flex-col gap-ui-md`, not to replace the shared width and padding defaults on every page.

```tsx
import { PageLayout } from '@/components/layouts/page-layout'

<PageLayout className="flex flex-col gap-ui-md">
  {/* Page sections */}
</PageLayout>

<PageLayout width="full">
  {/* A workspace that needs the available width */}
</PageLayout>
```

Keep one semantic `main` landmark in the app shell. `PageLayout` renders a div inside it, so individual pages can choose their own width without nesting main landmarks. Keep narrow forms or reading columns inside the page layout instead of shrinking the whole page wrapper.

## Compose large components by visual section

For large components, including multi-section pages, extract each meaningful visual section into a named component in the same file. Avoid splitting tiny markup fragments without a useful responsibility.

- Place the main page or base component first, followed by its section components. Type declarations and imports can precede the main component.
- Use the main component primarily for shared data, state, event coordination, and page layout. Pass sections the props they actually need.
- Keep state local to a section when no other section needs it. Do not add context, stores, or generic abstractions just to avoid a few props.
- Extract sections to separate files only when they are reused elsewhere or have enough independent responsibility to warrant it.

Verify affected callers, loading/error states, keyboard access, and layout at narrow and wide window sizes when relevant to the change.
