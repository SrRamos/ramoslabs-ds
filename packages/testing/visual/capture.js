/* eslint-disable @typescript-eslint/ban-ts-comment -- untyped harness script */
// @ts-nocheck -- plain-JS harness; behavior is covered by visual.test.js and the browser matrix.
/* global document -- used inside page.evaluate callbacks (browser context) */
// Deterministic capture (W1-312). One browser context per (engine, DPR); every request that is not the
// local loopback server is aborted and recorded, so a remote URL anywhere fails the run (hermetic).
// Fonts must be loaded, not substituted: a scene is only captured after every production family
// reports `loaded` through the FontFaceSet, otherwise the run throws (never a silent fallback).
import { chromium, firefox, webkit } from 'playwright';
import { FONTS } from './site.mjs';

export const ENGINES = { chromium, firefox, webkit };
export const VIEWPORT = { width: 480, height: 320 };

const LAUNCH_ARGS = {
  // Same raster on every run: no LCD text, no hinting variance, no GPU raster.
  chromium: [
    '--font-render-hinting=none',
    '--disable-lcd-text',
    '--disable-gpu',
    '--force-color-profile=srgb',
  ],
  firefox: [],
  webkit: [],
};

/** Launches `engine`; returns null when its browser is not installed (reported as not run). */
export async function launch(engine) {
  const type = ENGINES[engine];
  if (!type) throw new Error(`unknown engine ${engine}`);
  try {
    return await type.launch({ args: LAUNCH_ARGS[engine] });
  } catch (e) {
    if (/Executable doesn't exist|browserType\.launch/.test(String(e))) return null;
    throw e;
  }
}

/**
 * Captures every scene. Returns `{ shots: Map<name, Buffer>, blocked: string[] }`.
 * `origin` is the loopback site; `mutate(name, page)` is a test-only hook run before the shot.
 */
export async function captureScenes({ browser, origin, dpr, scenes, mutate }) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: dpr,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  const blocked = [];
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(origin + '/')) return route.continue();
    blocked.push(url);
    return route.abort();
  });
  const shots = new Map();
  try {
    for (const scene of scenes) {
      const page = await context.newPage();
      await page.goto(`${origin}/${scene.name}.html`, { waitUntil: 'load' });
      await assertFonts(page, scene.name);
      if (scene.focus) await page.keyboard.press('Tab');
      if (mutate) await mutate(scene.name, page);
      shots.set(
        scene.name,
        await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'device' }),
      );
      await page.close();
    }
  } finally {
    await context.close();
  }
  return { shots, blocked };
}

/** Throws unless each production family is loaded (not pending, not errored) and usable. */
async function assertFonts(page, scene) {
  const state = await page.evaluate(
    async (families) => {
      await document.fonts.ready;
      // Force-load every face: `font-display: block` only hides text, it does not trigger a fetch.
      await Promise.all(families.map((f) => document.fonts.load(`16px "${f}"`)));
      return {
        faces: [...document.fonts].map((f) => [f.family, f.status, f.display]),
        ok: families.map((f) => document.fonts.check(`16px "${f}"`)),
      };
    },
    FONTS.map((f) => f.family),
  );
  const bad = state.faces.filter(([, status]) => status !== 'loaded');
  const wrongDisplay = state.faces.filter(([, , display]) => display !== 'block');
  if (
    bad.length ||
    wrongDisplay.length ||
    state.ok.includes(false) ||
    state.faces.length < FONTS.length
  ) {
    throw new Error(`${scene}: fonts not ready (${JSON.stringify(state)})`);
  }
}
