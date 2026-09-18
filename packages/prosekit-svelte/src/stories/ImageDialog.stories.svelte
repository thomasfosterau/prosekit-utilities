<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import ImageDialog from '../lib/toolbar/ImageDialog.svelte';

  const { Story } = defineMeta({
    title: 'Toolbar/ImageDialog',
    component: ImageDialog,
    parameters: {
      docs: {
        description: {
          component:
            '`LinkDialog`’s contract on the one field ProseKit’s stock `image` node can hold. The applications this package was extracted from asked four questions and passed all four as node attributes; ProseMirror dropped three of them, so only `src` is asked for here.',
        },
      },
    },
  });
</script>

<Story name="Empty">
  <ImageDialog open onSubmit={() => undefined} />
</Story>

<Story name="Seeded">
  <ImageDialog open src="https://example.com/leaf.png" onSubmit={() => undefined} />
</Story>

<Story name="Labels of an application's own">
  <ImageDialog
    open
    titleLabel="Bild"
    srcLabel="Bildadresse"
    submitLabel="Einfügen"
    cancelLabel="Abbrechen"
    closeLabel="Schließen"
    invalidSrcMessage="Geben Sie eine http-, https- oder mailto-Adresse ein."
    onSubmit={() => undefined}
  />
</Story>
