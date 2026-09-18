import { describe, expect, it } from 'vite-plus/test';

describe('workspace scaffold', () => {
  it('runs the node suite', () => {
    expect(typeof globalThis.document).toBe('undefined');
  });
});
