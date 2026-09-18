<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import InlineEditor from '../lib/editor/InlineEditor.svelte';

  const { Story } = defineMeta({
    title: 'Editor/InlineEditor',
    component: InlineEditor,
    parameters: {
      docs: {
        description: {
          component:
            'One line of rich text: marks but no blocks, the `inlineDocument` ↔ `doc` remap, a hidden form input when `name` is given, and Enter bound to nothing — an inline document has no second block for it to make.',
        },
      },
    },
  });

  const stored = {
    type: 'inlineDocument',
    content: [
      { type: 'text', text: 'Broad beans, ' },
      { type: 'text', marks: [{ type: 'italic' }], text: 'Vicia faba' },
    ],
  };
</script>

<Story name="Empty">
  <InlineEditor label="Title" class="border-base-300 rounded border" />
</Story>

<Story name="Seeded from a stored document">
  <InlineEditor
    name="title"
    defaultContent={stored}
    label="Title"
    class="border-base-300 rounded border"
  />
</Story>
