// Svelte config for `svelte-package`, `svelte-check`, Storybook's
// `@storybook/sveltekit` framework and the vite-plugin-svelte compile step.
// A SvelteKit *app* on kit v3 has no svelte.config.js — it takes its config
// inline — but a library package still needs this file.
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: [vitePreprocess({ script: true })],
};
