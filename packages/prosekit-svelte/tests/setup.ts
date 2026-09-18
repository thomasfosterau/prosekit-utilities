/**
 * Vitest setup for this package's component suite.
 *
 * Registers the `@testing-library/jest-dom` matchers (`toBeInTheDocument`,
 * `toHaveAttribute`, `toHaveAccessibleName`, …) so they compose with Vitest
 * browser mode's retrying `expect.element(locator)`. Nothing else belongs
 * here: rendering and cleanup are `vitest-browser-svelte`'s, per test.
 */

import '@testing-library/jest-dom/vitest';
