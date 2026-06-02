import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Scope discovery to this repo's tests only. Excludes:
    //   - node_modules (default)
    //   - .claude/worktrees/** (sibling Claude harness worktrees)
    //   - content/** (iptf-map submodule has its own test suite)
    //   - map/** (legacy explorer; removed in cutover step 6)
    include: ['tests/**/*.{test,spec}.{js,mjs,ts}'],
    exclude: [
      '**/node_modules/**',
      '.claude/**',
      'content/**',
      'map/**',
      'dist/**',
    ],
  },
});
