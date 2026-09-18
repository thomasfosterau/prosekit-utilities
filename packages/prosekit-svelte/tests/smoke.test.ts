import { describe, expect, it } from 'vite-plus/test';

describe('workspace scaffold', () => {
  it('runs in a real browser', () => {
    expect(typeof globalThis.document).toBe('object');
    expect(navigator.userAgent).toContain('Chrome');
  });
});
