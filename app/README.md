# EquationAce Frontend (React + TypeScript + Vite)

This is the frontend application for EquationAce. It uses React, TypeScript, and Vite and includes a ready-to-use unit/integration testing setup with Vitest and Testing Library.

## Prerequisites
- Node.js 18+ and npm 9+ installed
- From the repository root, navigate into this app folder: `cd app`
- Install dependencies once: `npm install`

## How to run the app locally (manual verification)
1. Start the dev server: `npm run dev`
2. Open the printed local URL (typically http://localhost:5173).
3. Verify the page shows:
   - "Hello World - Math Expression Rewriting App"
   - A "MathML Rendering Demo" section with both "Native MathML" and "MathJax Fallback"
   - A "System Status" section with the frontend and MathML status lines

These are the same user-facing behaviors that the automated tests assert.

## Session Save/Load and Export
- Save (.eqace): Click "Save (.eqace)" in the header to download a JSON file capturing the full session:
  - steps: each step includes Content MathML, Presentation MathML, parentStepId, appliedRule, and selection metadata.
  - edges: derived from parentStepId, listing from->to for each step.
  - input: the current input text and its format (asciimath|mathml).
  - activeStepId and metadata.
- Load (.eqace): Click "Load (.eqace)" and select a previously saved file. The app restores the entire history and active step, and re-typesets math.

Notes:
- Math rendering uses MathJax SVG for export; on-screen, native MathML is used primarily, with MathJax available.
- The .eqace file is regular JSON and can be inspected manually if needed.

## How to run automated frontend tests
This project uses Vitest + @testing-library/react with a jsdom environment.

Common commands:
- Run the full test suite once (CI-friendly): `npm test`
- Watch mode during development: `npm run test:watch`
- Vitest UI (interactive web UI): `npm run test:ui`

What gets tested:
- Rendering of the main App component and key UI text (see `src/App.test.tsx`).
- Test environment is configured in `vitest.config.ts` and `src/test/setup.ts` with jest-dom matchers.

## Linting and formatting
- Lint: `npm run lint`
- Auto-fix lint issues: `npm run lint:fix`
- Format code: `npm run format`

## File map (testing-related)
- `vitest.config.ts` — Vitest configuration (jsdom, globals, setup files)
- `src/test/setup.ts` — Global test setup (jest-dom, hooks)
- `src/App.test.tsx` — Example tests verifying the main UI is rendered

## Tips
- If you add new components, place their tests next to the component file, e.g., `MyWidget.tsx` and `MyWidget.test.tsx`.
- Use Testing Library queries like `screen.getByRole` or `screen.getByText` to test user-visible behavior rather than implementation details.


## Keyboard Controls
These shortcuts work on the rendered math under the heading “Rendered (interactive)”. Make sure the interactive region is focused.

How to focus the interactive math area:
- Click anywhere on the rendered math; focus is moved there automatically.
- Or press Tab until the element with role "group" and label "Interactive math expression" is focused.

What you see while navigating:
- The currently selected subtree is highlighted in gold; hovering shows a cyan outline.
- The Expression textarea mirrors the selection: it shows the selected subtree in AsciiMath; without a selection it shows the whole expression.

Keys:
- ArrowUp — Expand selection to the parent node. If you are already at the root, nothing happens.
- ArrowDown — Contract selection to the first child. If you are on a leaf (like a single variable/number), nothing happens.
- ArrowLeft — Move to the previous sibling within the same parent (no wrap-around). Does nothing if there is no parent or you are at the first sibling.
- ArrowRight — Move to the next sibling within the same parent (no wrap-around). Does nothing if there is no parent or you are at the last sibling.
- Enter — Open the Rewrite Options dialog for the current selection. If nothing is selected yet, it first selects the whole expression (root) and then opens the dialog. Options are fetched from the backend when available.
- Escape — If the Rewrite Options dialog is open, closes it. Otherwise clears the current selection.

Mouse drag selection:
- Dragging across parts of the expression snaps the selection to the smallest DOM subtree that covers the drag range, which corresponds to a valid AST node. Keyboard navigation then continues from that node.

Accessibility notes:
- The interactive math region is focusable (tabIndex=0), has role="group" and an aria-label for screen readers.
- Keyboard controls only work while this region is focused.

Troubleshooting:
- If keys don’t do anything, click the math once to focus it, then try again.
- At structural boundaries (root/leaf/edge siblings), some arrows are no-ops by design.
