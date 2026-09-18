/**
 * `@thomasfosterau/prosekit-svelte` — Svelte 5 editor components on ProseKit.
 *
 * `Editor.svelte` carries this package's only side-effecting imports, the
 * ProseKit basic stylesheets, and through `createEditor` it pulls the
 * ProseKit runtime behind them. Import a component from here by path from a
 * route that genuinely edits a document, or through a dynamic `import()`
 * from one that only sometimes does; never re-export one from a barrel an
 * application loads on every page.
 *
 * @module
 */

export { default as BlockEditor } from './editor/BlockEditor.svelte';
export { default as Editor } from './editor/Editor.svelte';
export { default as InlineEditor } from './editor/InlineEditor.svelte';
export {
  defaultEditorMessages,
  getEditorMessages,
  setEditorMessages,
  type EditorMessages,
} from './messages.svelte.ts';
export { default as BlockToolbar } from './toolbar/BlockToolbar.svelte';
export { default as ImageDialog } from './toolbar/ImageDialog.svelte';
export {
  createDefaultSlashCommands,
  createDefaultToolbarItems,
  isToolbarSeparator,
  type SlashCommand,
  type ToolbarEditor,
  type ToolbarItem,
  type ToolbarRunContext,
  type ToolbarSeparator,
} from './toolbar/items.ts';
export { default as LinkDialog } from './toolbar/LinkDialog.svelte';
export { default as SlashMenu } from './toolbar/SlashMenu.svelte';
