// The `changes` job's slug filter (G3A R2-NICE-1): only a component's own locations narrow the run.
import { describe, expect, it } from 'vitest';
import { affected, ownerOf } from '../../../scripts/e2e-components.mjs';

const slugs = ['button', 'state', 'switch'];

describe('e2e component filter', () => {
  it('narrows to the component that owns every changed file', () => {
    const r = affected(
      [
        'packages/react/src/switch/SJSwitch.tsx',
        'packages/vue/src/generated/switch/aria.ts',
        'packages/css/src/switch.css',
        'packages/contracts/contracts/switch.contract.json',
        'packages/testing/specs/switch/l2.e2e.ts',
        'docs/readme.md',
      ],
      slugs,
    );
    expect(r).toEqual({ browser: true, components: ['switch'] });
  });
  it('runs every component for a shared file whose name or directory equals a slug', () => {
    for (const f of [
      'packages/core/src/live/state.ts',
      'packages/css/src/button-group.css',
      'packages/core/src/live/button.ts',
      'packages/core/src/live/switch/x.ts',
      'packages/testing/specs/state.ts',
    ])
      expect(affected([f], slugs).components, f).toEqual(slugs);
  });
  it('one shared file among owned ones runs all', () => {
    expect(
      affected(['packages/css/src/switch.css', 'packages/core/src/index.ts'], slugs).components,
    ).toEqual(slugs);
  });
  it('two owners run exactly those two', () => {
    expect(
      affected(['packages/css/src/switch.css', 'packages/css/src/button.css'], slugs).components,
    ).toEqual(['button', 'switch']);
  });
  it('workflow and config changes run all; docs-only skips the browser', () => {
    expect(affected(['.github/workflows/e2e.yml'], slugs).components).toEqual(slugs);
    expect(affected(['docs/a.md'], slugs)).toEqual({ browser: false, components: [] });
  });
  it('ownerOf is anchored', () => {
    expect(ownerOf('packages/css/src/switch.css', slugs)).toBe('switch');
    expect(ownerOf('packages/css/src/xswitch.css', slugs)).toBeNull();
  });
});
