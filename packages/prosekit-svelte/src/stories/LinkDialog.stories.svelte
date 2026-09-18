<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import LinkDialog from '../lib/toolbar/LinkDialog.svelte';

  const { Story } = defineMeta({
    title: 'Toolbar/LinkDialog',
    component: LinkDialog,
    parameters: {
      docs: {
        description: {
          component:
            'The link prompt as a bits-ui `Dialog`: `aria-modal`, the name wired to the title, a focus trap, Escape and focus return, all the primitive’s. What is local is the validation — an `href` that fails `isSafeHref` is refused in a `role="alert"` rather than becoming an anchor — and a `<form>`, so Enter in either field submits. Every story starts open; toggle the theme to review both palettes.',
        },
      },
    },
  });
</script>

<Story name="Empty">
  <LinkDialog open onSubmit={() => undefined} />
</Story>

<Story name="Editing an existing link">
  <LinkDialog
    open
    href="https://example.com/hedgerows"
    title="Hedgerows as habitat"
    onSubmit={() => undefined}
    onRemove={() => undefined}
  />
</Story>

<Story name="Labels of an application's own">
  <LinkDialog
    open
    titleLabel="Lien"
    hrefLabel="Adresse"
    linkTitleLabel="Titre (facultatif)"
    submitLabel="Appliquer"
    cancelLabel="Annuler"
    closeLabel="Fermer"
    invalidHrefMessage="Saisissez une adresse http, https ou mailto."
    onSubmit={() => undefined}
  />
</Story>
