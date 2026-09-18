<script module lang="ts">
  import { defineBlockDocumentExtension } from '@thomasfosterau/prosekit-utilities/prosekit';
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import Editor from '../lib/editor/Editor.svelte';
  import BlockToolbar from '../lib/toolbar/BlockToolbar.svelte';
  import {
    createDefaultSlashCommands,
    createDefaultToolbarItems,
    type SlashCommand,
    type ToolbarItem,
    type ToolbarSeparator,
  } from '../lib/toolbar/items.ts';

  const { Story } = defineMeta({
    title: 'Toolbar/BlockToolbar',
    component: BlockToolbar,
    parameters: {
      docs: {
        description: {
          component:
            'The toolbar, rendered from a list of items. bits-ui’s `Toolbar` owns the keyboard model — one tab stop, arrow keys, Home and End — and `kind: "toggle"` items carry `aria-pressed` read from their own `isActive`. The insert button is a bits-ui `DropdownMenu`; the link and image dialogs are rendered by the toolbar and opened through `ToolbarRunContext.dialogs`.',
        },
      },
    },
  });

  /** An application's own item, appended to the default set. */
  const shoutItem: ToolbarItem = {
    id: 'shout',
    label: 'Shout',
    kind: 'action',
    run: ({ editor }) => {
      editor.commands['insertText']?.({ text: '!!!' });
    },
  };

  /** An application's own insert-menu entry. */
  const shoutCommand: SlashCommand = {
    id: 'shout',
    label: 'Exclamation',
    run: ({ editor }) => {
      editor.commands['insertText']?.({ text: '!!!' });
    },
  };

  const extended: ReadonlyArray<ToolbarItem | ToolbarSeparator> = [
    ...createDefaultToolbarItems(),
    { id: 'app-items', separator: true },
    shoutItem,
  ];
</script>

<Story name="The default set">
  <Editor extension={defineBlockDocumentExtension()} label="Post body" class="border-base-300 rounded border">
    <BlockToolbar />
  </Editor>
</Story>

<Story name="Extended by an application">
  <Editor extension={defineBlockDocumentExtension()} label="Post body" class="border-base-300 rounded border">
    <BlockToolbar
      items={extended}
      slashCommands={[...createDefaultSlashCommands(), shoutCommand]}
    />
  </Editor>
</Story>

<Story name="A short set of an application's own">
  <Editor extension={defineBlockDocumentExtension()} label="Comment body" class="border-base-300 rounded border">
    <BlockToolbar
      label="Comment toolbar"
      items={createDefaultToolbarItems().slice(0, 4)}
      slashCommands={createDefaultSlashCommands().slice(0, 3)}
    />
  </Editor>
</Story>
