/* eslint-disable @typescript-eslint/ban-ts-comment -- plain-JS test */
// @ts-nocheck -- test helpers are untyped.
// Browser-free checks of the SJSwitch visual set (W1-C03s.f): scene names unique, markup is the adapters' markup
// shape, tokens only, the sets cover every state the contract names (and forced-colors and RTL), and the
// baseline directory has no unreviewed file (nothing self-approved).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyBaselines } from '../../visual/baselines.js';
import { sceneHtml } from '../../visual/site.mjs';
import { SWITCH_SCENES } from './scenes.js';

const ROOT = join(import.meta.dirname, 'baselines');

describe('SJSwitch visual scenes', () => {
  it('have unique names and render a real switch', () => {
    const names = SWITCH_SCENES.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const s of SWITCH_SCENES) {
      expect(s.html).toContain('type="checkbox"');
      expect(s.html).toContain('role="switch"');
      expect(s.html).toContain('class="sj-switch__thumb"');
      expect(sceneHtml(s)).toContain('/components.css');
    }
  });

  it('cover off, on, disabled, focus, long label, RTL and forced colors', () => {
    const n = SWITCH_SCENES.map((s) => s.name).join(' ');
    for (const k of ['off', 'on', 'disabled', 'focus', 'long-label', 'rtl', 'forced-colors'])
      expect(n).toContain(k);
    expect(SWITCH_SCENES.filter((s) => s.forced).length).toBeGreaterThanOrEqual(2);
    expect(SWITCH_SCENES.some((s) => s.focus)).toBe(true);
  });

  it('use no raw colour or pixel values (tokens only)', () => {
    for (const s of SWITCH_SCENES) {
      expect(s.html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(s.html).not.toMatch(/\d\s*px/);
      expect(s.html).not.toContain('style=');
    }
  });

  it('has no baseline image without a human review-log entry (nothing is self-approved)', () => {
    expect(verifyBaselines(ROOT)).toEqual([]);
    const pngs = readdirSync(ROOT, { recursive: true }).filter((f) => String(f).endsWith('.png'));
    expect(pngs).toEqual([]); // pending human review; see visual.mjs candidates / update
  });
});
