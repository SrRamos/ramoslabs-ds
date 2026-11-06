// Contrast and colour-vision metrics for every palette, shared by the story tables, the docs text and the
// research doc numbers. Floors: 4.5:1 text, 3:1 non-text (WCAG 2.2 1.4.3 / 1.4.11).
import { apca, deltaE, fmtOklch, over, simulate, wcag, type Cvd } from './color';
import { PAGE, PALETTES, PRIMITIVES, SHEEN, TONES, type Palette, type Roles, type Tone } from './palettes';

const WHITE = '#ffffff';
const TEXT_BODY = '#334155'; // color.text-body (slate 700)
const TEXT_BODY_DARK = '#cbd5e1'; // color.slate.300, the dark-surface body text the proposal uses

export type Check = { label: string; fg: string; bg: string; ratio: number; floor: number };

/** Dark roles resolved: status solids are shared with light, neutral inverts on dark. */
export function dark(r: Roles) {
  return {
    solid: r.dSolid ?? r.solid,
    solidEnd: r.dSolidEnd ?? r.solidEnd,
    solidBorder: r.dSolidBorder ?? r.solidBorder,
    hover: r.dHover ?? r.hover,
    hoverEnd: r.dHoverEnd ?? r.hoverEnd,
    press: r.dPress ?? r.press,
    on: r.dOn ?? r.on,
  };
}

/** Every pair a tone renders, light and dark. */
export function checks(r: Roles): Check[] {
  const d = dark(r);
  const c = (label: string, fg: string, bg: string, floor = 4.5): Check => ({
    label,
    fg,
    bg,
    ratio: wcag(fg, bg),
    floor,
  });
  return [
    c('solid rest', r.on, r.solid),
    c('solid sheen', r.on, over(WHITE, SHEEN, r.solid)),
    c('solid hover sheen', r.on, over(WHITE, SHEEN, r.hover)),
    c('solid press', r.on, r.press),
    c('solid gradient end', r.on, r.solidEnd),
    c('text on white', r.text, WHITE),
    c('text on soft', r.text, r.surface),
    c('text on soft hover', r.text, r.surfaceHover),
    c('text on soft press', r.text, r.surfacePress),
    c('strong text on soft', r.textStrong, r.surface),
    c('body on alert', TEXT_BODY, r.surface),
    c('outline border', r.outline, WHITE, 3),
    c('dark solid sheen', d.on, over(WHITE, SHEEN, d.solid)),
    c('dark solid hover sheen', d.on, over(WHITE, SHEEN, d.hover)),
    c('dark solid press', d.on, d.press),
    c('dark text on page', r.dText, PAGE.dark),
    c('dark text on soft', r.dText, r.dSurface),
    c('dark text on soft press', r.dText, r.dSurfacePress),
    c('dark strong on soft', r.dTextStrong, r.dSurface),
    c('dark body on alert', TEXT_BODY_DARK, r.dSurface),
    c('dark outline border', r.dOutline, PAGE.dark, 3),
  ];
}

export type ToneRow = {
  tone: Tone;
  solid: string;
  oklch: string;
  on: string;
  rest: number;
  sheen: number;
  hover: number;
  press: number;
  apcaSheen: number;
  text: string;
  textWhite: number;
  textSoftPress: number;
  apcaText: number;
  dText: string;
  dTextPage: number;
  apcaDark: number;
  min: number;
  isNew: string;
};

const token = (hex: string) => PRIMITIVES[hex] ?? 'NEW';

export function rows(p: Palette): ToneRow[] {
  return TONES.map((tone) => {
    const r = p.tones[tone];
    const all = checks(r).filter((x) => x.floor === 4.5);
    return {
      tone,
      solid: r.solid,
      oklch: fmtOklch(r.solid),
      on: r.on,
      rest: wcag(r.on, r.solid),
      sheen: wcag(r.on, over(WHITE, SHEEN, r.solid)),
      hover: Math.min(wcag(r.on, r.hover), wcag(r.on, over(WHITE, SHEEN, r.hover))),
      press: wcag(r.on, r.press),
      apcaSheen: apca(r.on, over(WHITE, SHEEN, r.solid)),
      text: r.text,
      textWhite: wcag(r.text, WHITE),
      textSoftPress: wcag(r.text, r.surfacePress),
      apcaText: apca(r.text, WHITE),
      dText: r.dText,
      dTextPage: wcag(r.dText, PAGE.dark),
      apcaDark: apca(r.dText, PAGE.dark),
      min: Math.min(...all.map((x) => x.ratio)),
      isNew: [r.solid, r.text, r.surface, r.dText].map(token).join(' / '),
    };
  });
}

/** Lowest text ratio across every pair of the palette, and where it is. */
export function floor(p: Palette): { ratio: number; where: string } {
  let best = { ratio: 99, where: '' };
  for (const t of TONES)
    for (const c of checks(p.tones[t]))
      if (c.floor === 4.5 && c.ratio < best.ratio) best = { ratio: c.ratio, where: `${t}, ${c.label}` };
  return best;
}

/** Failing pairs (must be empty for a proposal palette). */
export function failures(p: Palette): string[] {
  return TONES.flatMap((t) =>
    checks(p.tones[t])
      .filter((c) => c.ratio < c.floor)
      .map((c) => `${t} ${c.label}: ${c.fg} on ${c.bg} = ${c.ratio}`),
  );
}

export const VISIONS = ['normal', 'deuteranopia', 'protanopia', 'tritanopia'] as const;
export type Vision = (typeof VISIONS)[number];

/** Closest pair of solids (status + Indigo 600 primary) under each vision type, deltaE OK x100. */
export function separation(p: Palette): Record<Vision, { dE: number; pair: string }> {
  const set: Record<string, string> = { primary: '#4f46e5' };
  for (const t of TONES) if (t !== 'neutral') set[t] = p.tones[t].solid;
  const out = {} as Record<Vision, { dE: number; pair: string }>;
  for (const v of VISIONS) {
    const sim = Object.entries(set).map(([n, h]) => [n, v === 'normal' ? h : simulate(h, v as Cvd)] as const);
    let best = { dE: 99, pair: '' };
    for (let i = 0; i < sim.length; i++)
      for (let j = i + 1; j < sim.length; j++) {
        const d = deltaE(sim[i]![1], sim[j]![1]);
        if (d < best.dE) best = { dE: d, pair: `${sim[i]![0]} / ${sim[j]![0]}` };
      }
    out[v] = best;
  }
  return out;
}

/** Markdown summary for the story docs panel. */
export function describe(p: Palette): string {
  const r = rows(p);
  const sep = separation(p);
  const f = floor(p);
  const table = [
    '| Tone | Solid (OKLCH) | Hex | Label | WCAG rest / sheen / hover / press | APCA Lc (sheen) | Text on white | WCAG white / soft press | APCA | Dark text | WCAG on slate 900 | APCA | Primitive (solid / text / soft / dark text) |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...r.map(
      (x) =>
        `| ${x.tone} | \`${x.oklch}\` | \`${x.solid}\` | \`${x.on}\` | ${x.rest} / ${x.sheen} / ${x.hover} / ${x.press} | ${x.apcaSheen} | \`${x.text}\` | ${x.textWhite} / ${x.textSoftPress} | ${x.apcaText} | \`${x.dText}\` | ${x.dTextPage} | ${x.apcaDark} | ${x.isNew} |`,
    ),
  ].join('\n');
  const cvd = VISIONS.map((v) => `${v} ${sep[v].dE} (${sep[v].pair})`).join(', ');
  return `**${p.name}.** ${p.tagline}

${table}

Lowest text pair: **${f.ratio}:1** (${f.where}). Closest two solids, deltaE OK x100: ${cvd}.

Trade-offs:
${p.tradeoffs.map((t) => `- ${t}`).join('\n')}`;
}

export { PALETTES };
