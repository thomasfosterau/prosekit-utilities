import type { Preview } from '@storybook/sveltekit';
import './preview.css';

/**
 * Stories render against daisyUI's `light` and `dark` themes, toggled from
 * the toolbar so both palettes are reviewable without a second build.
 */
const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'daisyUI theme',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light' },
  decorators: [
    (story, context) => {
      document.documentElement.dataset.theme = String(context.globals.theme);
      return story();
    },
  ],
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/ } },
  },
};

export default preview;
