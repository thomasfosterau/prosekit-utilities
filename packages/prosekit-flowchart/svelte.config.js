// Svelte config for `svelte-package`, `svelte-check` and the
// vite-plugin-svelte compile step. Identical to the editor package's: a
// library package still needs this file even though a kit v3 *app* does not.
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: [vitePreprocess({ script: true })],
};
