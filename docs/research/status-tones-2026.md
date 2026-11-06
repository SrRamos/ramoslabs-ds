# SJButton status tones: research and proposal (2026-11)

Status: **research and proposal only.** `packages/tokens` and `packages/css/src/button.css` do not change
until the owner picks a palette. The proposal is in Storybook under **Components / Button / Tone Proposal**
(`apps/storybook/stories/components/ButtonToneProposal.stories.ts`). The colour maths, contrast checks and
palette data are in `apps/storybook/stories/components/tone-proposal/`. Every number below is produced by
that code, so the swatches, the rendered buttons and this document share one set of values.

Scope: the success, warning, error, info and neutral tones of the Direction B button (#126), and the same
hues in alerts, badges and field messages. Indigo 600 (`#4f46e5`) stays the primary action colour. Violet
stays decorative.

Note: the brief points to `docs/research/button-premium-2026.md`. That file exists only on the unmerged
`feature/button-redesign-proposal` branch (#124), not on `main`. This document stands on its own.

## 1. Why the current tones read as "rustic"

These are measured values. The current fills are emerald 800, amber 500 (slate 900 label), red 700,
blue 700 and slate 900.

| Tone | Hex | OKLCH | Problem |
|---|---|---|---|
| success | `#065f46` | L 43.2, C 0.086, h 167 | Deep bottle green at low chroma. Next to Indigo 600 (C 0.230) it looks dull and dusty. |
| warning | `#f59e0b` | L 76.9, C 0.165, h 70 | It is 34 L points lighter than every other fill and close to the sRGB cusp. It shouts, and it is the only dark-label button. |
| error | `#b91c1c` | L 50.5, C 0.190, h 28 | Fine on its own. At h 28 it leans toward orange-brick, which is warmer than the cool indigo. |
| info | `#1d4ed8` | L 48.8, C 0.217, h 264 | Only 13 degrees from Indigo 600 (h 277): a second, slightly-off primary. Under tritanopia the two merge (deltaE OK 1.0). |
| neutral | `#0f172a` | L 20.8, C 0.040, h 266 | Fine. On a dark page it disappears, and there is no dark counterpart. |

The root cause is that each fill was picked from a different step of an unrelated Tailwind ramp (800, 500,
700, 700, 900). No shared rule governs lightness, chroma or hue, so the row reads as five swatches rather
than one family.

## 2. How premium systems pick status colours

All values come from published token files or official docs, read on 2026-11-06.

| System | Solid success / warning / error / info | Warning label | Text on white (success / warning / error / info) | Method notes |
|---|---|---|---|---|
| **Radix Colors** (step 9) | green `#30a46c`, amber `#ffc53d`, red `#e5484d`, blue `#0090ff` | dark (amber, yellow, sky, mint and lime are "designed for dark foreground text") | step 11: `#218358` / `#ab6400` / `#ce2c31` / `#0d74ce` | 12-step scales. Step 9 is "the highest chroma" and is identical in light and dark. Steps 11 and 12 "are guaranteed to Lc 60 and Lc 90 APCA contrast" on step 2. |
| **GitHub Primer** v11.10 | `#1f883d` / `#9a6700` / `#cf222e` / `#0969da` | **white** (it darkens attention to `#9a6700` instead) | `#1a7f37` / `#9a6700` / `#d1242f` / `#0969da` | Dark mode uses translucent muted backgrounds (`#2ea04326`). |
| **Shopify Polaris** v9.4 | `#047b5d` / `#ffb800` / `#c70a24` / `#91d0ff` | dark `#251a00` (on info too) | `#014b40` / `#5e4200` / `#8e0b21` / `#003a5a` | Warm, desaturated text ramps. No dark status tokens published. |
| **IBM Carbon** v11 | `#24a148` / `#f1c21b` / `#da1e28` / `#0043ce` | (icons and borders only) | text-error `#da1e28` | The `support-*` colours are for icons and borders, not text-bearing fills. |
| **Atlassian** tokens v20 | `#5B7F24` / `#FBC828` / `#C9372C` / `#1868DB` | dark `#292A2E` | `#4C6B1F` / `#9E4C00` / `#AE2E24` / `#1558BC` | Warning text is an orange-brown (h ~50), not olive. Dark: bold fills get lighter (`#F87168`). |
| **Vercel Geist** (step 700) | `#45a557` / `#ffb224` / `#e5484d` / `#0072f5` | (unconfirmed) | step 900: `#297a3a` / `#a35200` / `#cb2a2f` / `#0068d6` | Radix-derived (red 700 equals Radix red 9). P3 variants in OKLCH, e.g. green `oklch(64.58% .199 147.27)`. |
| **Apple HIG** | `#34c759` / `#ff8d28`, `#ffcc00` / `#ff383c` / `#0088ff` | (n/a) | increased contrast: `#008932` / `#c55300` / `#e9152d` / `#1e6ef4` | Separate dark and "increased contrast" variants for every system colour. |
| **Linear** | (status hex unconfirmed) | | | Themes are generated in **LCH**, "a red and a yellow color with lightness 50 will appear roughly equally light". Three inputs (base, accent, contrast) replace 98 variables. |
| **Stripe** | (not published) | | | Built in **CIELAB** so that "each color … has the same contrast value at a given level". "'Really dark yellow' isn't actually a thing". Colours darkened to pass contrast become "dark and muddy". |

What they have in common:

1. **A perceptual space defines the steps.** Linear uses LCH, Stripe uses Lab, and Radix and Geist use
   APCA-tuned scales with OKLCH P3 variants. Lightness is shared across hues at each step, so every tone
   sits at the same visual weight.
2. **Warning is the special case.** Most systems (Radix, Polaris, Atlassian) keep warning light and give it
   a dark label. Primer is the exception: it darkens the fill to an ochre-brown so it can keep white text.
3. **Text ramps drift warm and dark.** Every system's warning text sits at h 50–60 (`#9E4C00`, `#a35200`,
   `#ab6400`), never at the yellow fill's h 85. A dark yellow at its own hue turns olive.
4. **Dark mode has its own text and surface steps.** Fills can be shared, as in Radix and Geist step 9/700.
   Text and surfaces always change.
5. **Info is kept away from the brand.** Radix and Geist pair indigo-ish brands with a sky/azure blue.
   Primer's accent *is* its blue, so it uses no separate info.

## 3. Perceptual method (OKLCH)

OKLCH is Ottosson's OKLab (bottosson.github.io/posts/oklab) in polar form: L (perceived lightness 0–1),
C (chroma), h (hue angle). It predicts perceived lightness far better than HSL, where "at the same level of
mathematical lightness, yellow appears lighter than blue" (Stripe).

The proposal uses OKLCH as follows:

- **Shared lightness.** The status fills sit at one L. In A that is L 49–50, one step under Indigo 600
  (L 51.1), so the primary stays the brightest action. The ceiling is set by the label: white text must
  hold 4.5:1 on the lightest *sheened* pixel. The search below found the maximum L per hue:

  | Hue | Max L for white on the 12% sheen |
  |---|---|
  | h 145–165 (greens) | 0.495–0.500 |
  | h 240–260 (blues) | 0.505–0.520 |
  | h 20–30 (reds) | 0.52–0.545 |

  Greens set the ceiling because green carries the most luminance per unit of L.
- **Per-hue chroma.** Equal C does not look equally colourful. The proposal lowers C on green and blue
  (0.11–0.13) and allows more on red (0.175), so that no tone shouts and none looks grey. sRGB also caps
  chroma: at L 0.49 a green cannot exceed C ≈ 0.12, which is why emerald 800 and A's jade are about as
  saturated as a deep green can be in sRGB.
- **Hue placement.**
  - Success moves to jade (h 158–165). A grass green (h 140–145) at L 49 drifts toward olive.
  - Error moves to crimson (h 16–22). The brick zone is h 25–30 at low chroma, which is what makes reds
    look rustic.
  - Info moves to cerulean (h 240–245), 30+ degrees clear of indigo.
  - Warning text moves to h 55–60 (burnt orange) while the warning fill stays at h 78–82 (honey).
- **Why some greens and yellows look cheap at full chroma.** In sRGB the yellow cusp sits at L ≈ 0.97 and
  the green cusp at L ≈ 0.87. Maximum chroma for those hues therefore only exists at very high lightness,
  where it reads as neon (highlighter yellow, `#00ff00`). Darkening the same hue collapses chroma toward
  the gamut wall, and a perceived hue shift (the Bezold–Brücke effect) makes dark yellow look olive or
  brown. Stripe's "really dark yellow isn't a thing" is the same observation. Two fixes follow:
  - keep yellow light and give it a dark label
  - or rotate it toward orange before darkening (Primer, Atlassian, palette B)

## 4. Harmony with Indigo 600

- **Temperature.** Indigo 600 is cool and blue-violet (h 277). Cool-leaning status hues sit with it
  without fighting: jade rather than lime, crimson rather than tomato, cerulean rather than royal blue.
  Warning is the one warm tone, so it gets the least chroma that still reads as amber (C 0.12–0.14 in A
  and C, against 0.165 for amber 500).
- **Chroma matching.** Indigo 600 has C 0.230, the most of any colour on screen. Status fills sit at about
  50–75% of that, so the primary stays the loudest colour. This is the "one indigo per view" rule
  expressed in numbers.
- **Tinted neutrals.** Slate is tinted toward h 257–266, a plain blue-grey. A and C tint the neutral ink
  toward h 277 (`#222538`, C 0.036), the brand hue, so the Cancel button and Archived badge feel related to
  indigo without becoming coloured. B uses a cooler graphite (h 258, C 0.019) for contrast. On dark, the
  neutral solid inverts to a light fill with an ink label (`#eceef7` / `#222538`), as Atlassian
  (`#CECFD2`) and Geist do. A near-black solid on slate 900 is invisible.
- **The hover halo.** `--shadow-glow` is an indigo halo. On a green or red button it adds a violet fringe.
  The proposal takes the halo from the tone's own fill (`color-mix(in srgb, <solid> 22%, transparent)`,
  3px). This is a small token change (§8).

## 5. Contrast

All ratios are WCAG 2.x, floored to 2 dp like `packages/testing/contrast`. "Sheen" is the label on
`compositeOver(#fff, 12%, fill)`, the lightest pixel, exactly as `packages/css/test/button.test.js`
computes it. Hover is the lower of the hover fill and the sheened hover fill. Press has no gradient and no
sheen.

APCA Lc (0.0.98G-4g) is a secondary signal, against these thresholds from git.apcacontrast.com:

| Lc | Use |
|---|---|
| 90 | Preferred for body text |
| 75 | Minimum for body text |
| 60 | Minimum for other content text and UI labels |
| 45 | Headlines and fine icons |
| 30 | Solid non-text |

Floors held by every palette: 4.5:1 for every label and status text pair, including the soft press
surface, the alert body text and the dark-surface equivalents, and 3:1 for the outline border. The story
refuses to render a palette with any pair below the floor (`failures()` throws).

**Warning label, white or dark?** For premium, the evidence favours **dark ink on a light amber**:

- Radix, Polaris and Atlassian all do this.
- It lets warning stay a recognisable amber instead of an orange-brown.
- The label clears the floor easily: in palette A, 8.55 at rest, 9.12 on the sheen and 6.7 on press,
  with Lc 72.

A white label needs the fill at L ≤ ~0.53. At that lightness, amber at h 70–80 is brown, so the hue has
to rotate to orange (B, h 44, `#af4400`). It passes (4.62 on the sheen), but it moves warning toward error
(deltaE 10.1 in normal vision, the closest pair in B). A and C use a warm ink (`#432105`, `#402712`)
rather than slate 900, so the label belongs to the fill.

## 6. Colour-vision deficiency

Simulation uses Machado, Oliveira & Fernandes 2009 (IEEE TVCG 15(6), doi:10.1109/TVCG.2009.113) at full
severity, in linear RGB. The same matrices run in the story as SVG `feColorMatrix` filters. Distinctness
is the closest pair of fills (the four status tones plus Indigo 600) in deltaE OK ×100. About 2 is
barely noticeable; above 5 is clearly different.

| Palette | Normal | Deuteranopia | Protanopia | Tritanopia |
|---|---|---|---|---|
| Current | 5.5 primary/info | 2.5 primary/info | 2.2 primary/info | **1.0 primary/info** |
| A. Harmonic | 14.1 primary/info | 5.4 success/error | 11.2 primary/info | 3.5 success/info |
| B. Jewel | 10.1 warning/error | 4.8 success/error | 4.8 success/warning | 3.9 primary/info |
| C. Quiet | 11.2 success/info | 3.6 success/error | 8.8 success/error | 2.8 success/info |

The current info button is effectively the primary for anyone with tritanopia, and nearly so for
protanopia and deuteranopia. A improves the worst case for every deficiency type except tritanopia, where
B is slightly ahead (3.9 against 3.5). As AGENTS.md requires, every status in the story also carries an
icon and a word.

## 7. Dark mode

- **Fills are shared.** The status solids keep their light-mode values on dark, following Radix step 9
  and Geist 700. They keep white (or ink) labels and AA on the sheen.
- **Neutral inverts** (§4).
- **Text, surfaces, borders and outlines have dark counterparts.**
  - Text: L 0.78–0.84 at moderate chroma.
  - Soft surfaces: L 0.255 / 0.29 / 0.325 (rest / hover / press), tinted by the tone's hue.
  - Alert border: L 0.36.
  - Outline border: text L − 0.12, still ≥ 3:1 on slate 900.
- Measured on slate 900, dark text sits at 9.0–10.8:1 (A). The dark error text was raised so all three
  palettes clear APCA Lc 60, at Lc −64.
- **Finding outside this scope:** primary has no dark counterpart either. Indigo 600 as outline or ghost
  text on slate 900 is **2.83:1 (Lc −20)**, which is below AA. Indigo 400 (`#818cf8`, 5.98:1) or 300
  (8.95:1) would be the dark primary text. The Indigo primary is out of scope for this change, but this
  needs its own fix before the DS ships a dark theme.
- The DS has no dark disabled style. The story uses slate 800 / 500 / 700 as a placeholder.

## 8. The palettes

All four are rendered in the story. The tables below are generated by `describe()` in `metrics.ts`.

### Current (baseline)

What ships in #126: Tailwind-family primitives at mixed lightness. Emerald 800, amber 500 with slate 900 text, red 700, blue 700, slate 900. Soft and outline use the green / amber / red / blue 800-900 text steps.

| Tone | Solid (OKLCH) | Hex | Label | WCAG rest / sheen / hover / press | APCA Lc (sheen) | Text on white | WCAG white / soft press | APCA | Dark text | WCAG on slate 900 | APCA | Primitive (solid / text / soft / dark text) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| success | `oklch(43.2% 0.086 167)` | `#065f46` | `#ffffff` | 7.68 / 5.77 / 7.03 / 15.15 | -83.9 | `#166534` | 7.13 / 5.88 | 84.4 | `#86efac` | 12.71 | -83 | emerald.800 / green.800 / green.50 / green.300 |
| warning | `oklch(76.9% 0.165 70)` | `#f59e0b` | `#0f172a` | 8.31 / 9.09 / 10.69 / 5.6 | 64.9 | `#78350f` | 9.07 / 7.28 | 90.3 | `#fcd34d` | 12.38 | -81.3 | amber.500 / amber.900 / amber.50 / amber.300 |
| error | `oklch(50.5% 0.190 28)` | `#b91c1c` | `#ffffff` | 6.47 / 5.42 / 6.6 / 10.01 | -81.2 | `#991b1b` | 8.31 / 5.74 | 87.1 | `#fca5a5` | 9.4 | -65.4 | red.700 / red.800 / red.50 / red.300 |
| info | `oklch(48.8% 0.217 264)` | `#1d4ed8` | `#ffffff` | 6.7 / 5.25 / 6.48 / 10.35 | -80.9 | `#1e40af` | 8.72 / 6.13 | 89.2 | `#93c5fd` | 9.9 | -68.1 | blue.700 / blue.800 / blue.50 / blue.300 |
| neutral | `oklch(20.8% 0.040 266)` | `#0f172a` | `#ffffff` | 17.85 / 12.61 / 9.99 / 20.17 | -102 | `#334155` | 10.35 / 6.97 | 94 | `#cbd5e1` | 12.02 | -79.3 | slate.900 / slate.700 / slate.100 / slate.300 |

Lowest text pair: **5.25:1** (info, solid sheen). Closest two solids, deltaE OK x100: normal 5.5 (primary / info), deuteranopia 2.5 (primary / info), protanopia 2.2 (primary / info), tritanopia 1 (primary / info).

Trade-offs:
- Five fills at five different lightnesses (OKLCH L 43 to 77): the row reads as a set of unrelated swatches, not a family.
- Emerald 800 is a deep bottle green at low chroma (0.086); next to the vivid Indigo 600 (0.230) it looks dull, the "rustic" note.
- Amber 500 is the lightest and loudest fill; with slate 900 text it is the only dark-label button and it shouts.
- Blue 700 (h 264) is 13 degrees from Indigo 600 (h 277): info reads as a second, slightly-off primary.
- No dark counterparts exist: dark rows here map to the 300 / 950 steps by hand.

### A. Harmonic

One lightness for every status fill (OKLCH L 49, a step under Indigo 600 at L 51 so the primary stays the brightest), chroma tuned per hue so no tone shouts, hues pulled away from muddy zones: jade green, crimson-leaning red, cerulean info 30 degrees clear of indigo, honey amber with a warm ink label. Neutral is an indigo-tinted ink.

| Tone | Solid (OKLCH) | Hex | Label | WCAG rest / sheen / hover / press | APCA Lc (sheen) | Text on white | WCAG white / soft press | APCA | Dark text | WCAG on slate 900 | APCA | Primitive (solid / text / soft / dark text) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| success | `oklch(49.0% 0.110 160)` | `#03734a` | `#ffffff` | 5.9 / 4.63 / 5.4 / 8.44 | -77.3 | `#126b47` | 6.52 / 5.2 | 81.9 | `#68d7a1` | 10.05 | -69.1 | NEW / NEW / NEW / NEW |
| warning | `oklch(83.5% 0.140 80)` | `#f8be52` | `#432105` | 8.55 / 9.12 / 7.71 / 6.7 | 72.4 | `#8d4908` | 6.79 / 5.32 | 83 | `#f7c15f` | 10.83 | -73.3 | NEW / NEW / NEW / NEW |
| error | `oklch(49.9% 0.175 22)` | `#b12532` | `#ffffff` | 6.6 / 5.38 / 6.42 / 9.21 | -81.3 | `#a8212e` | 7.18 / 5.57 | 83.4 | `#ffa09c` | 9.14 | -64 | NEW / NEW / NEW / NEW |
| info | `oklch(50.0% 0.125 245)` | `#0068a5` | `#ffffff` | 5.96 / 4.69 / 5.39 / 8.4 | -77.7 | `#00629d` | 6.49 / 5.1 | 81.6 | `#78bff9` | 9.02 | -63.3 | NEW / NEW / NEW / NEW |
| neutral | `oklch(27.1% 0.036 277)` | `#222538` | `#ffffff` | 15.11 / 10.36 / 8.75 / 16.99 | -98.1 | `#43465b` | 9.26 / 7.25 | 91.4 | `#c0c3d1` | 10.17 | -69.5 | NEW / NEW / NEW / NEW |

Lowest text pair: **4.63:1** (success, solid sheen). Closest two solids, deltaE OK x100: normal 14.1 (primary / info), deuteranopia 5.4 (success / error), protanopia 11.2 (primary / info), tritanopia 3.5 (success / info).

Trade-offs:
- Most cohesive: the four status fills read as one family next to Indigo 600, because they share its lightness and sit at similar perceived colourfulness.
- Lowest WCAG headroom on the fills (white on the sheened fill 4.63 on success, 4.69 on info): any later sheen increase must be re-checked.
- Jade (h 160) and cerulean (h 245) are less literal than "traffic light" green and blue; still read as success and info in context.
- Every value is NEW: the system gains five OKLCH status scales (or at least the 15 steps used here).

### B. Jewel

Deeper, richer fills (OKLCH L 45 to 46, warning 52) with the most chroma sRGB allows at that depth: emerald, ruby, sapphire. Warning keeps a white label on a burnt orange. Highest contrast of the three, the "Stripe dashboard" register. Neutral is cool graphite.

| Tone | Solid (OKLCH) | Hex | Label | WCAG rest / sheen / hover / press | APCA Lc (sheen) | Text on white | WCAG white / soft press | APCA | Dark text | WCAG on slate 900 | APCA | Primitive (solid / text / soft / dark text) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| success | `oklch(44.9% 0.105 158)` | `#00663e` | `#ffffff` | 7.07 / 5.41 / 6.25 / 10 | -82 | `#00663e` | 7.07 / 5.65 | 83.9 | `#63d99b` | 10.14 | -69.6 | NEW / NEW / NEW / NEW |
| warning | `oklch(52.5% 0.154 44)` | `#af4400` | `#ffffff` | 5.75 / 4.62 / 5.28 / 8.05 | -77 | `#943c0c` | 7.21 / 5.61 | 84.3 | `#ffad8b` | 9.86 | -68 | NEW / NEW / NEW / NEW |
| error | `oklch(46.1% 0.180 18)` | `#a5092f` | `#ffffff` | 7.83 / 6.5 / 7.58 / 10.82 | -86 | `#a11732` | 7.82 / 6.02 | 85.4 | `#ff9fa2` | 9.12 | -63.9 | NEW / NEW / NEW / NEW |
| info | `oklch(46.1% 0.152 255)` | `#0056aa` | `#ffffff` | 7.21 / 5.55 / 6.36 / 10.07 | -82.6 | `#0056aa` | 7.21 / 5.67 | 84.3 | `#85baff` | 8.89 | -62.5 | NEW / NEW / NEW / NEW |
| neutral | `oklch(25.0% 0.019 258)` | `#1c222b` | `#ffffff` | 15.99 / 10.97 / 9.33 / 17.64 | -99.3 | `#404855` | 9.22 / 7.22 | 91.3 | `#bec4ce` | 10.18 | -69.5 | NEW / NEW / NEW / NEW |

Lowest text pair: **4.62:1** (warning, solid sheen). Closest two solids, deltaE OK x100: normal 10.1 (warning / error), deuteranopia 4.8 (success / error), protanopia 4.8 (success / warning), tritanopia 3.9 (primary / info).

Trade-offs:
- Most contrast headroom on success, error and info (white on the sheened fill 5.4 to 6.5:1); the white-label warning is the exception at 4.62.
- Warning with a white label forces the hue toward orange (h 44) and darkens it to L 52: it reads "caution" well but sits closest to error, and under protanopia / deuteranopia warning and error converge more than in A or C.
- Deeper fills look heavier on dark surfaces and lose some glow; the gradient is less visible.
- Sapphire (h 255) is closer to indigo than A's cerulean; info and primary are distinguishable but related.

### C. Quiet

Linear / Geist register: low-chroma fills (C 0.09 to 0.13) so status never competes with the Indigo primary; emphasis moves to soft and outline. Sage green, muted rose-red, steel blue, a soft honey warning with ink text. Neutral is a cool indigo-tinted graphite.

| Tone | Solid (OKLCH) | Hex | Label | WCAG rest / sheen / hover / press | APCA Lc (sheen) | Text on white | WCAG white / soft press | APCA | Dark text | WCAG on slate 900 | APCA | Primitive (solid / text / soft / dark text) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| success | `oklch(48.1% 0.086 164)` | `#236d51` | `#ffffff` | 6.21 / 4.74 / 5.55 / 8.76 | -78.2 | `#22664d` | 6.82 / 5.45 | 83.3 | `#84d1af` | 9.96 | -68.5 | NEW / NEW / NEW / NEW |
| warning | `oklch(84.1% 0.120 82)` | `#f2c36a` | `#402712` | 8.43 / 8.95 / 7.6 / 6.59 | 73 | `#814c1a` | 7.04 / 5.51 | 84.1 | `#f2c777` | 11.23 | -75.3 | NEW / NEW / NEW / NEW |
| error | `oklch(49.0% 0.140 16)` | `#a03645` | `#ffffff` | 6.75 / 5.28 / 6.14 / 9.52 | -81.1 | `#973240` | 7.37 / 5.71 | 84.8 | `#f7a3a8` | 9.14 | -64 | NEW / NEW / NEW / NEW |
| info | `oklch(49.1% 0.095 240)` | `#226791` | `#ffffff` | 6.14 / 4.74 / 5.5 / 8.68 | -78.2 | `#1b618a` | 6.72 / 5.28 | 82.8 | `#87c2ec` | 9.31 | -64.8 | NEW / NEW / NEW / NEW |
| neutral | `oklch(28.9% 0.026 278)` | `#282a38` | `#ffffff` | 14.2 / 9.65 / 8.14 / 16 | -96.6 | `#494c5b` | 8.5 / 6.65 | 89.3 | `#c4c7d1` | 10.57 | -71.7 | NEW / NEW / NEW / NEW |

Lowest text pair: **4.74:1** (success, solid sheen). Closest two solids, deltaE OK x100: normal 11.2 (success / info), deuteranopia 3.6 (success / error), protanopia 8.8 (success / error), tritanopia 2.8 (success / info).

Trade-offs:
- Calmest and most "tool-like": the primary is unambiguously the loudest colour on the screen.
- Lowest chroma means the smallest colour differences between tones: under CVD it leans hardest on the icon and label (still required by AGENTS.md).
- Error at C 0.14 (a muted rose-red, h 16, kept off the brick zone around h 25-30) is less urgent; destructive confirmations may want the solid from A instead.
- Risk of reading "grey" on low-quality or dimmed displays.
## 9. Recommendation: A. Harmonic

**Rule:** status fills share one OKLCH lightness just under the primary, with chroma tuned per hue and
hues kept out of the muddy and brick zones. Warning is the one light fill and carries a warm ink label.
**Why:** it is the only palette where the five tones read as a single family next to Indigo 600. It also
gives the best colour-vision separation overall: the worst case under deuteranopia and protanopia is
5.4, against 2.2–2.5 today. Info stops impersonating the primary (deltaE 14.1, against 5.5 today). It
keeps dark labels and white labels where the leading systems keep them.

Costs to accept:

- **Thin headroom.** White on the sheened success fill is 4.63 and on the sheened info fill 4.69. Raising
  `--opacity-sheen` above 12% would break both. The existing sheen test in
  `packages/css/test/button.test.js` already guards this.
- **Every value is new.** The tones are not Tailwind steps.

When the alternatives would be better:

- **B** is the better pick if the owner wants more contrast headroom and a "stronger" register (success,
  error and info at 5.4–6.5 on the sheen) and accepts a burnt-orange warning that sits closer to error.
- **C** is the better pick if status should recede almost entirely behind the primary. Its brick risk is
  fixed (rose-red h 16), but it has the weakest colour-vision separation.

### Token changes A would need

**New primitives** (OKLCH source, hex output, in `color.primitive.json`). Each status hue needs the
following steps. Values are for palette A.

| Family | Fill / end / border | Hover / hover end / press | Text / strong / outline | Surface / hover / press / border | Dark text / strong / outline | Dark surface / hover / press / border |
|---|---|---|---|---|---|---|
| jade (h 160) | `#03734a` `#00603d` `#005334` | `#006641` `#005334` `#005938` | `#126b47` `#015636` `#388963` | `#ebfcf2` `#d9f6e5` `#c7efd8` `#b4e7ca` | `#68d7a1` `#90ebbb` `#3db07c` | `#0f291c` `#143223` `#193c2b` `#1f4633` |
| honey (h 80, text h 55) | `#f8be52` `#e8ae3f` `#d09820` · ink `#432105` | `#eeb447` `#dea433` `#e1a737` | `#8d4908` `#733800` `#ae662f` | `#fff6e3` `#feecc8` `#fae1ad` `#f5d594` | `#f7c15f` `#ffdca1` `#cf9a35` | `#2b210e` `#352a12` `#3f3217` `#493b1d` |
| crimson (h 22) | `#b12532` `#9c0421` `#8a001b` | `#a31227` `#8a001b` `#94001e` | `#a8212e` `#8b1221` `#cb454a` | `#fff4f3` `#ffe7e6` `#fddbd8` `#f8cdcb` | `#ffa09c` `#ffc3c0` `#d87876` | `#371818` `#441f1e` `#502525` `#5d2d2c` |
| cerulean (h 245) | `#0068a5` `#00578b` `#004b7a` | `#005c94` `#004b7a` `#005182` | `#00629d` `#004e7e` `#2580c1` | `#f0f8ff` `#e0f0ff` `#d0e7fc` `#c0ddf7` | `#78bff9` `#a2d4ff` `#5399d1` | `#0b2539` `#0e2e46` `#123753` `#18405f` |
| ink (h 277) | `#222538` `#191b2d` `#141728` | `#2e3145` `#24273a` `#191b2d` | `#43465b` `#313446` `#5e6278` | `#f5f6fc` `#ebedf6` `#e1e3ef` `#d5d8e7` | `#c0c3d1` `#d8dae6` `#9b9eab` | `#20222f` `#282a3a` `#303345` `#383c50` · dark solid `#eceef7` / `#dfe1e9` / `#cfd0d9` |

Steps that repeat (for example success solid border = hover end) collapse into one primitive, which
leaves roughly 15–18 steps per family. A full 11-step OKLCH ramp per family (50–950) generated by the
same method is the cleaner token shape. It keeps the DS's existing naming, and the values above become
its 50 / 100 / 200 / 300 / 400 / 600 / 700 / 800 / 900 / 950 steps.

**Semantic changes** (`color.semantic.json`):

- Repoint the existing `success`, `success-strong`, `success-surface`, `success-border` and
  `success-text` tokens, and their warning, error and info equivalents, to the new families.
- Add `*-solid`, `*-solid-hover`, `*-solid-press`, `*-on-solid` (needed for warning's ink),
  `*-text-strong` and `*-outline`.
- Add a dark set, `*-text-dark` / `*-surface-dark` / `*-border-dark`, or a `[data-theme=dark]` layer.
- Neutral: add `neutral-solid` (ink) and its dark inverse. `text-body` and the slate greys stay as they
  are. Moving all greys to the indigo-tinted ink is a separate, larger decision.

**Effect tokens:** `shadow.glow` becomes `shadow.lift` plus a tone-coloured halo. Split it into
`shadow.glow-width` (3px) and `opacity.glow` (22%) so `button.css` can mix the halo from each tone's fill.

**`button.css`:** only the variable names change. The structure and the test (`contrast.test.js` reads
the pairs back from the built CSS) stay the same.

## 10. Sources

- Radix Colors scales: raw.githubusercontent.com/radix-ui/colors/main/src/light.ts and `/src/dark.ts`
- Radix, "Understanding the scale": radix-ui.com/colors/docs/palette-composition/understanding-the-scale
- GitHub Primer primitives 11.10: unpkg.com/@primer/primitives@11.10.0/dist/css/functional/themes/light.css
  and `dark.css`
- Shopify Polaris tokens 9.4.2: unpkg.com/@shopify/polaris-tokens@9.4.2/dist/css/styles.css
- IBM Carbon themes 11.85: unpkg.com/@carbon/themes@11.85.0/js/generated/themes/white.js and `g100.js`
- Atlassian tokens 20.9: unpkg.com/@atlaskit/tokens@20.9.0/dist/esm/artifacts/themes/atlassian-light.js
  and `atlassian-dark.js`
- Vercel Geist colours: vercel.com/geist/colors
- Apple HIG, Color: developer.apple.com/design/human-interface-guidelines/color
- Linear, "How we redesigned the Linear UI": linear.app/now/how-we-redesigned-the-linear-ui
- Stripe, "Designing accessible color systems" (2019): stripe.com/blog/accessible-color-systems
- APCA in a Nutshell: git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html
- Ottosson, "A perceptual color space for image processing" (2020): bottosson.github.io/posts/oklab
- Machado, Oliveira, Fernandes (2009), "A Physiologically-based Model for Simulation of Color Vision
  Deficiency", IEEE TVCG 15(6):1291–1298, doi:10.1109/TVCG.2009.113
- WCAG 2.2 contrast: w3.org/TR/WCAG22/#dfn-contrast-ratio
