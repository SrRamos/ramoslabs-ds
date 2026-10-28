#!/usr/bin/env node
/* eslint-disable @typescript-eslint/ban-ts-comment -- untyped harness script */
// @ts-nocheck -- plain-JS harness, same convention as packages/testing/visual/cli.js
// SJButton visual run (W1-C01.f): check | candidates | update | verify, all in visual/component-cli.js.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../../../visual/component-cli.js';
import { SCENES } from './scenes.js';

process.exit(
  await main({
    label: 'button',
    slug: 'button',
    scenes: SCENES,
    root: join(dirname(fileURLToPath(import.meta.url)), 'baselines'),
  }),
);
