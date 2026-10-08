---
paths:
  - 'packages/prosekit-svelte/**'
  - 'packages/prosekit-flowchart/**'
---

# Svelte authoring rules

Apply to both Svelte packages. Package-local invariants are in each package's `CLAUDE.md`.

- **Svelte 5 runes and snippets only.** `$props`, `$state`, `$derived`, `$effect`, `{#snippet}` / `{@render}`. No `export let`, no slots, no stores in component code (ProseKit's own node-view contract hands stores in; that boundary is the one exception), no legacy event directives.
- **Merge the caller's `class` last** with Svelte class arrays (`class={['btn', className]}`); there is no `clsx`. Every component also spreads the caller's native attributes (`...rest`, typed `Omit<HTMLAttributes<…>, 'children'>`) on the element it renders, before its own attributes. A component that owns its accessible name (`label`, `menuLabel`) also omits `'aria-label' | 'aria-labelledby'` from that type, sets its own `aria-label` after the spread and clears `aria-labelledby={undefined}` there too (it would outrank `aria-label`), and pins both halves with a `// @ts-expect-error` per attribute in its browser test, which `svelte-check` reads. Onto a bits-ui primitive, redeclare `id?: string | undefined` and pass it only when defined (bits-ui's `id` takes no `null`, and no `undefined` under `exactOptionalPropertyTypes`), and omit any attribute bits-ui retypes and overwrites (the menu content's `dir`). Where `class` lands on an inner styling element, the rest goes on the element that carries the role (`SlashMenu`: the `role="menu"` content, not the `role="none"` list). The dialogs put the rest on bits-ui's `Dialog.Content` (`role="dialog"`, where `class` lands too); bits-ui merges its own `role`, `aria-modal` and `aria-labelledby` / `aria-describedby` after it. `EditableNode` and `FlowchartNodeView` take neither: xyflow and ProseKit instantiate them.
- **Every user-facing string is a prop with an English default; accessible-name props end in `Label`.** Item labels are data in the toolbar spec. The optional per-render-site messages context (`setEditorMessages`) only changes those defaults. There is no message catalogue.
- **No Effect.** The Svelte packages never import `effect`; the flowchart's `./node` entry is the one exception, and it is not a Svelte module.
- **bits-ui owns interaction.** Toolbar (roving focus, `aria-pressed`), the insert menu, the dialogs. Hand-rolling needs a reason in the component's header comment.
- **daisyUI semantic classes come from a literal lookup table, never a template string**, and never a raw colour — Tailwind only emits classes it can read in source. The consuming app ships Tailwind + daisyUI, and the READMEs say so.
- **Every component opens with a one-line `<!-- @component … -->` doc** (what it is for, plus any context it must render inside); that is what a consumer's editor shows on hover. Maintainer rationale goes in a separate plain `<!-- … -->` header.
- **Every component ships with a story and a browser test** — `src/stories/<Component>.stories.@(ts|svelte)` (flat, outside `src/lib/`, so it never ships) and `tests/<Component>.test.ts`, asserting accessible name, role and keyboard path with real pointer and keyboard events. Snippet-taking components use Svelte CSF; prop-only ones plain CSF. Story export names must be valid identifiers.
- **In a `.ts` test, `render(Component, props)` cannot take a prop named `anchor`, `target`, `props`, `events`, `context` or `intro`**; nest such props under `props:`. Vitest's Playwright locator mutates the `position` object you pass it — pass a fresh point per call.
- **`optimizeDeps.include` lists every runtime dependency the browser suite reaches**, so Vite never discovers one mid-run and reloads the page.
