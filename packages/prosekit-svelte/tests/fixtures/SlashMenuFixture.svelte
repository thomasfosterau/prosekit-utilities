<!-- `SlashMenu` on its own inside a mounted editor — the arrangement a custom
     toolbar makes. The trigger snippet is why this is a fixture and not a
     bare `render`. -->
<script lang="ts">
  import { defineBlockDocumentExtension } from '@thomasfosterau/prosekit-utilities/prosekit';
  import Editor from '../../src/lib/editor/Editor.svelte';
  import type { SlashCommand } from '../../src/lib/toolbar/items.ts';
  import SlashMenu from '../../src/lib/toolbar/SlashMenu.svelte';

  interface Props {
    commands: ReadonlyArray<SlashCommand>;
    label?: string | undefined;
    menuLabel?: string | undefined;
    withTrigger?: boolean | undefined;
  }

  let { commands, label, menuLabel, withTrigger = false }: Props = $props();

  const extension = defineBlockDocumentExtension();
</script>

<Editor {extension}>
  {#if withTrigger}
    <SlashMenu {commands} {label} {menuLabel}>
      {#snippet trigger({ props })}
        <button {...props} type="button" data-testid="own-trigger">Add something</button>
      {/snippet}
    </SlashMenu>
  {:else}
    <SlashMenu {commands} {label} {menuLabel} />
  {/if}
</Editor>
