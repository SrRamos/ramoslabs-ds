#!/usr/bin/env node
/* eslint-disable @typescript-eslint/ban-ts-comment -- untyped harness script */
// @ts-nocheck -- plain-JS harness, same convention as packages/testing/visual/cli.js
// SJCheckbox visual run (W1-C03c.f): check | candidates | update | verify, all in visual/component-cli.js.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../../../visual/component-cli.js';
import { SCENES, mutate } from './scenes.js';

process.exit(
  await main({
    label: 'checkbox',
    slug: 'checkbox',
    scenes: SCENES,
    root: join(dirname(fileURLToPath(import.meta.url)), 'baselines'),
    mutate,
  }),
);
