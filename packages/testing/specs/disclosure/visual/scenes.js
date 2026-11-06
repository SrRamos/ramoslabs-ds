/* eslint-disable @typescript-eslint/ban-ts-comment -- untyped harness script */
// @ts-nocheck -- plain-JS harness; behaviour is covered by conformance.test.ts and the browser matrix.
// SJDisclosure visual scenes (W1-C06.f, ADR-013 L5), in the shape the visual harness (visual/) consumes. Static
// markup identical to what the adapters render; tokens only, no raw values. NOT self-approved: the baselines
// below `baselines/` stay empty until a human reviews candidates (see visual/cli.js). `forced` and `rtl` are
// applied by the capture hook (forced-colors emulation) or by the markup (dir). `<details open>` is plain
// markup, so the open scenes need no script.
import { CONTENT, LONG_SUMMARY, SUMMARY } from '../fixtures.ts';

const dc = (
  state,
  { disabled = false, title = SUMMARY, id = 'dc', name, content = CONTENT } = {},
) => {
  const d = disabled ? ' data-disabled="true"' : '';
  return (
    `<details id="${id}" class="sj-disclosure__root" data-part="root" data-state="${state}"${d}` +
    `${name ? ` name="${name}"` : ''}${state === 'open' ? ' open' : ''}>` +
    `<summary id="${id}-trigger" class="sj-disclosure__trigger" data-part="trigger" data-state="${state}"${d}` +
    `${disabled ? ' aria-disabled="true"' : ''}>${title}</summary>` +
    `<div id="${id}-panel" class="sj-disclosure__content" data-part="content" data-state="${state}"${d}>${content}</div></details>`
  );
};
/** Scenes are flex items that shrink to their content; a fixed token-based width shows the chevron at the end. */
const FRAME = 'style="inline-size: calc(var(--space-32) * 3)"';
const frame = (html, attrs = '') => `<div ${attrs} ${FRAME}>${html}</div>`;
const group = (openIndex) =>
  ['Shipping', 'Returns', 'Warranty']
    .map((t, i) =>
      dc(i === openIndex ? 'open' : 'closed', {
        title: t,
        id: `g${i}`,
        name: 'faq',
        content: `${t} panel`,
      }),
    )
    .join('');

export const SCENES = [
  { name: 'disclosure-closed', html: frame(dc('closed')) },
  { name: 'disclosure-open', html: frame(dc('open')) },
  { name: 'disclosure-disabled', html: frame(dc('closed', { disabled: true })) },
  { name: 'disclosure-focus-closed', html: frame(dc('closed')), focus: true },
  { name: 'disclosure-focus-open', html: frame(dc('open')), focus: true },
  { name: 'disclosure-long-title', html: frame(dc('closed', { title: LONG_SUMMARY })) },
  { name: 'disclosure-exclusive-group', html: frame(group(0)) },
  { name: 'disclosure-closed-rtl', html: frame(dc('closed'), 'dir="rtl"') },
  { name: 'disclosure-open-rtl', html: frame(dc('open'), 'dir="rtl"') },
  { name: 'disclosure-closed-forced-colors', html: frame(dc('closed')), forced: true },
  { name: 'disclosure-open-forced-colors', html: frame(dc('open')), forced: true },
  {
    name: 'disclosure-disabled-forced-colors',
    html: frame(dc('closed', { disabled: true })),
    forced: true,
  },
];

/** Capture hook: forced-colors scenes run under `forced-colors: active` emulation. */
export const mutate = async (name, page) => {
  if (SCENES.find((s) => s.name === name)?.forced)
    await page.emulateMedia({ forcedColors: 'active' });
};
