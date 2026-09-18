<script module lang="ts">
  import { defineBlockDocumentExtension } from '@thomasfosterau/prosekit-utilities/prosekit';
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import Editor from '../lib/editor/Editor.svelte';
  import BlockToolbar from '../lib/toolbar/BlockToolbar.svelte';
  import MessagesProvider from './MessagesProvider.svelte';

  const { Story } = defineMeta({
    title: 'Editor/Messages',
    parameters: {
      docs: {
        description: {
          component:
            '`setEditorMessages(partial)` changes the English defaults for one subtree — the optional half of the copy story, on top of every string already being a prop. It is set per render site, never from a root layout: wiring it high in the tree would mean importing this package’s barrel there, and `Editor.svelte`’s stylesheet imports would land in every page’s shared chunk. With no provider mounted, every string is its English default.',
        },
      },
    },
  });
</script>

<Story name="No provider — English defaults">
  <Editor
    extension={defineBlockDocumentExtension()}
    label="Post body"
    class="border-base-300 rounded border"
  >
    <BlockToolbar />
  </Editor>
</Story>

<Story name="A partial German override">
  <MessagesProvider
    overrides={{
      toolbarLabel: 'Werkzeugleiste',
      insertLabel: 'Einfügen',
      insertMenuLabel: 'Block einfügen',
      bold: 'Fett',
      italic: 'Kursiv',
      underline: 'Unterstrichen',
      quote: 'Zitat',
      slashParagraph: 'Absatz',
      slashHeading2: 'Überschrift 2',
      linkDialogTitle: 'Link',
      imageDialogTitle: 'Bild',
    }}
  >
    <Editor
      extension={defineBlockDocumentExtension()}
      label="Post body"
      class="border-base-300 rounded border"
    >
      <BlockToolbar />
    </Editor>
  </MessagesProvider>
</Story>
