/**
 * Vitest setup for this package's component suite: registers the
 * `@testing-library/jest-dom` matchers so they compose with Vitest browser
 * mode's retrying `expect.element(locator)`.
 */

import '@testing-library/jest-dom/vitest';
