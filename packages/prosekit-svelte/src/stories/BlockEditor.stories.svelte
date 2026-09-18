<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import BlockEditor from '../lib/editor/BlockEditor.svelte';

  const { Story } = defineMeta({
    title: 'Editor/BlockEditor',
    component: BlockEditor,
    parameters: {
      docs: {
        description: {
          component:
            'The block-document editor: the default grammar, the default toolbar, the envelope remap (`blockDocument` ↔ `doc`) and a hidden form input when `name` is given. `toolbar={false}` drops the toolbar; a `toolbar` snippet replaces it.',
        },
      },
    },
  });

  const stored = {
    type: 'blockDocument',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Autumn sowing' }] },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Broad beans go in once the soil is below 15°C.' }],
      },
    ],
  };
</script>

<Story name="Default">
  <BlockEditor label="Post body" class="border-base-300 rounded border" />
</Story>

<Story name="Seeded from a stored document">
  <BlockEditor
    name="body"
    defaultContent={stored}
    label="Post body"
    class="border-base-300 rounded border"
  />
</Story>

<Story name="Without a toolbar">
  <BlockEditor toolbar={false} label="Comment body" class="border-base-300 rounded border" />
</Story>

<Story name="With a toolbar of its own">
  <BlockEditor label="Post body" class="border-base-300 rounded border">
    {#snippet toolbar()}
      <p class="text-base-content/70 text-sm">An application's own toolbar goes here.</p>
    {/snippet}
  </BlockEditor>
</Story>
