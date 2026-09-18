<script module lang="ts">
  import { defineBlockDocumentExtension } from '@thomasfosterau/prosekit-utilities/prosekit';
  import { defineInlineDocumentExtension } from '@thomasfosterau/prosekit-utilities/prosekit';
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import Editor from '../lib/editor/Editor.svelte';

  const { Story } = defineMeta({
    title: 'Editor/Editor',
    component: Editor,
    parameters: {
      docs: {
        description: {
          component:
            'The bare ProseKit mount: an extension in, a bindable `content` out, and this package’s only side-effecting imports (`prosekit/basic/style.css`, `prosekit/basic/typography.css`). `label` names the wrapper as a `role="group"`; `children` renders inside the provider, which is where a toolbar goes.',
        },
      },
    },
  });

  const seeded = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'A hedgerow is a habitat, not a fence.' }],
      },
    ],
  };
</script>

<Story name="Empty">
  <Editor extension={defineBlockDocumentExtension()} label="Post body" class="border-base-300 rounded border" />
</Story>

<Story name="Seeded">
  <Editor
    extension={defineBlockDocumentExtension()}
    defaultContent={seeded}
    label="Post body"
    class="border-base-300 rounded border"
  />
</Story>

<Story name="Inline grammar">
  <Editor
    extension={defineInlineDocumentExtension()}
    label="Title"
    class="border-base-300 rounded border"
  />
</Story>
