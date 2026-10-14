# Node-based Calculator

A React Flow calculator built with React, TypeScript, and Vite. Compose named numbers, arithmetic expressions, and nested if/else decisions on one canvas.

## Getting started

Use Node.js 22.12 or newer (verified with Node.js 22.22.2).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Build and preview with `npm run build` and `npm run preview`.

## Building a graph

1. Add a **Variable**, give it a unique name such as `price`, and enter its value.
2. Add a **Calculation** and connect the variable's output port to its Dependencies port. Enter an expression such as `price * (2 + 1)`.
3. Add a **Control flow** node. Connect the outputs used by its condition to Dependencies, select the operands, and choose `<`, `<=`, `>`, `>=`, `==`, or `!=`.
4. Choose the control's result type. Variable mode uses numeric If/Else values or Variable-mode child controls. Calculation mode takes calculations or Calculation-mode child controls at its If/Else ports. Each child has its own dependencies.

Every node produces a named number, including calculations and controls. Only directly connected dependency names are available in a formula or condition; connecting a child to If/Else does not also expose it as a condition input. A control's output name stays the same when its selected branch changes. Nested controls must match their parent's result type; ordinary dependency connections accept any node's numeric output.

Results update live. Calculations support decimal and scientific numbers, unary signs, `+`, `-`, `*`, `/`, and parentheses with standard precedence. JavaScript, functions, implicit multiplication, and compound boolean conditions are not supported. Errors in unused dependencies or inactive branches do not block the selected result. Numbers use JavaScript's standard floating-point precision; division by zero and non-finite results are errors.

Names are case-sensitive and unique across the workspace. Start with a letter or underscore and continue with letters, numbers, or underscores. Commit a rename with Enter or by leaving the field; directly connected formulas update their exact identifier references. Invalid name drafts remain editable while the last valid name stays committed.

Drag node headers to move nodes. Select a card and drag its edges or corner handles to resize it; minimum sizes keep all fields and connection ports visible. Double-click a dependency chip's name to select and center its source card. Keyboard users can focus the chip and press Enter or Space. The adjacent disconnect button removes only that connection.

Drag between ports, or click one port followed by another, to connect. Self-links, duplicate edges, cycles, incompatible branches, and multiple connections to one branch are rejected. Disconnect branch links before changing a control's result type. Select nodes or edges and press Delete/Backspace, use the toolbar, or delete a node with its trash button. Typing in fields does not activate canvas deletion or dragging. The canvas provides pan, zoom, and fit-view controls.

## Saving and opening

**Save JSON** downloads a version 1 document containing nodes, connections, positions, resized card dimensions, the viewport, and unfinished fields. Explicit width and height are optional, so existing files still open at their default card sizes. Computed results, selection, automatic node measurements, and UI callbacks are excluded. **Open** restores a chosen JSON document and recalculates results. Malformed files, unsupported versions, invalid graph connections, and duplicate committed names are rejected before changing the workspace. Incomplete expressions, values, and disconnected condition references can be saved as editable drafts.

The unsaved indicator covers field edits and graph layout changes, including panning and zooming. New/Open offer Save and continue, Discard, or Cancel before replacing unsaved work. Save and continue initiates a browser download; ensure the file is retained in your downloads. Browser closure, refresh, and navigation use the browser's native unsaved-changes prompt when edits are pending. Switching or moving tabs keeps the in-memory workspace. Reopening starts empty; open a saved file to recover work. There is no autosave or restart recovery.

## Development checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run format:check
```

Run `npm run format` to format project files. Vitest covers arithmetic, graph evaluation, connection rules, renaming, document round trips, unsaved-change transitions, and renderer file workflows.

## Project structure

- `src/renderer/src/main.tsx`: React entry point.
- `src/renderer/src/app.tsx`: Application entry component.
- `src/renderer/src/features/calculator`: Graph model, expression parser, evaluator, document codec, workspace state, canvas, and node editors.
- `src/renderer/src/components/ui`: Shared shadcn primitives.
- `src/renderer/src/components/layouts/page-layout.tsx`: Shared page widths and gutters.
- `src/renderer/src/assets/main.css`: Semantic theme and density tokens.
- `src/renderer/src/lib/utils.ts`: Class-name utility.

The `@/` alias points to `src/renderer/src`. The renderer directory follows the project UI skill; the current app runs in a browser through Vite.

## UI conventions

Follow `.agents/skills/project-ui/SKILL.md` and `.agents/skills/shadcn/SKILL.md`. Pages compose `PageLayout` inside the shell's single `main` landmark. Scrolling areas use the shared `ScrollArea`.

Set `data-density` on `<html>` to `compact`, `balanced`, or `comfortable`. Balanced is the default. Add the `dark` class to `<html>` to use the dark theme. Use semantic color and density tokens for new UI.

Inter and Lora are bundled locally through `@fontsource` packages, which include their font licenses. No runtime font downloads are needed.

The shadcn registry is configured in `components.json`. Add components with:

```sh
npx shadcn@latest add <component>
```
