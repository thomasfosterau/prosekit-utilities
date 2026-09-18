<!-- A mounted block editor with `BlockToolbar` inside its provider — the
     arrangement `BlockEditor` makes, with every toolbar prop reachable from
     a `.ts` test. -->
<script lang="ts">
  import { defineBlockDocumentExtension } from '@thomasfosterau/prosekit-utilities/prosekit';
  import Editor from '../../src/lib/editor/Editor.svelte';
  import BlockToolbar from '../../src/lib/toolbar/BlockToolbar.svelte';
  import type { SlashCommand, ToolbarItem, ToolbarSeparator } from '../../src/lib/toolbar/items.ts';

  interface Props {
    items?: ReadonlyArray<ToolbarItem | ToolbarSeparator> | undefined;
    slashCommands?: ReadonlyArray<SlashCommand> | undefined;
    label?: string | undefined;
    insertLabel?: string | undefined;
    insertMenuLabel?: string | undefined;
  }

  let { items, slashCommands, label, insertLabel, insertMenuLabel }: Props = $props();

  const extension = defineBlockDocumentExtension();
</script>

<Editor {extension}>
  <BlockToolbar {items} {slashCommands} {label} {insertLabel} {insertMenuLabel} />
</Editor>
