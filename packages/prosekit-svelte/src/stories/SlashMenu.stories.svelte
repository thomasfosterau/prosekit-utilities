<script module lang="ts">
  import { defineBlockDocumentExtension } from '@thomasfosterau/prosekit-utilities/prosekit';
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import Editor from '../lib/editor/Editor.svelte';
  import { createDefaultSlashCommands } from '../lib/toolbar/items.ts';
  import SlashMenu from '../lib/toolbar/SlashMenu.svelte';

  const { Story } = defineMeta({
    title: 'Toolbar/SlashMenu',
    component: SlashMenu,
    parameters: {
      docs: {
        description: {
          component:
            'The insert menu on its own — a bits-ui `DropdownMenu` with `aria-haspopup="menu"` and `aria-expanded` on the trigger, `role="menu"` / `role="menuitem"` inside, arrow-key roving focus, typeahead and Escape. It needs a mounted editor above it, so every story renders it inside an `Editor`. The `trigger` snippet lets a custom toolbar supply its own control.',
        },
      },
    },
  });

  const commands = createDefaultSlashCommands();
</script>

<Story name="Default trigger">
  <Editor
    extension={defineBlockDocumentExtension()}
    label="Post body"
    class="border-base-300 rounded border"
  >
    <SlashMenu {commands} />
  </Editor>
</Story>

<Story name="A trigger of the caller's own">
  <Editor
    extension={defineBlockDocumentExtension()}
    label="Post body"
    class="border-base-300 rounded border"
  >
    <SlashMenu {commands} menuLabel="Add a block">
      {#snippet trigger({ props })}
        <button {...props} type="button" class="btn btn-sm btn-primary">Add a block</button>
      {/snippet}
    </SlashMenu>
  </Editor>
</Story>

<Story name="A short set">
  <Editor
    extension={defineBlockDocumentExtension()}
    label="Comment body"
    class="border-base-300 rounded border"
  >
    <SlashMenu commands={commands.slice(0, 3)} label="Block" />
  </Editor>
</Story>
