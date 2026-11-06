# SJButton redesign: premium button research (2026-11)

Status: **research and proposal only.** Nothing in tokens, `packages/css/src/button.css` or the components
changes until the owner picks a direction. The proposal is in Storybook under
**Components / Button / Proposal** (`apps/storybook/stories/components/ButtonProposal.stories.ts`).

## 1. Owner feedback and root causes

| # | Feedback | Root cause in the current code |
|---|---|---|
| 1 | Variant colours feel rustic, dated | Six solid tones (emerald 700, amber 500, blue 700, slate 800, red 600, indigo 600), all flat, all with the same weight. Premium systems give a solid fill to two or three tones at most (see §2.3). |
| 2 | Fonts too basic | `font.family.sans` = Rubik, `display` = Red Hat Display (`packages/tokens/src/tokens/typography.json`). |
| 3 | Sizes only change font size; shape amorphous, Bootstrap-like | Every size has `min-block-size: var(--target-min)` (44px), so sm and md are both 44px tall. Padding is fixed at space-2/space-4. `radius-md` and the base font apply to every size, so radius does not scale with height. The DS's own `radius.sm` token is described as "Signature control radius. Buttons…", but the button uses `radius.md`. |
| 4 | "As Link" shows a solid and an outlined button | The story renders `SJButton href=…`: an `<a>` styled as a button. See §6. |
| 5 | Icon-only, same criticism | It is a 44px square at every size, because it inherits the 44px minimum. |
| 6 | Likes RTL | Kept. Every direction has an Arabic and a Hebrew row, with mirrored directional icons. |

## 2. How premium systems size and style buttons

All numbers come from source code, token files or live production CSS, checked 2026-11-06. "unconfirmed"
means no primary source showed the value.

### 2.1 Heights, padding, radius, type

| System | Heights (px) | Padding-inline | Radius | Font size / weight / tracking | Icon / gap | Icon-only |
|---|---|---|---|---|---|---|
| **Radix Themes** | 24 / 32 / 40 / 48 | 8 / 12 / 16 / 24 | 3 / 4 / 6 / 8 (scales with size) | 12 / 14 / 16 / 18, 500, +0.0025em → −0.0025em | gap 4 / 8 / 12 / 12 | 24 / 32 / 40 / 48 squares |
| **Vercel Geist** | small 32, medium 36, large 40 | 6 + 6 label span, 10 + 6, 14 + 6 | 6 / 6 / 8 | 14 / 14 / 16, 500 | 16 icons | 32 / 36 / 40, optional circle |
| **Linear** (marketing CSS) | mini 24, small 32, medium 40, large 44 | 10 / 12 / 14 / 20 | pill by default, 4 when square | 12 / 13 / 13 / 16, weight **510**, −0.01 to −0.011em | 12 / 16 / 16 / 18, gap 4–8 | unconfirmed |
| **shadcn/ui** (new-york-v4) | 24 / 32 / 36 / 40 | 8 / 12 / 16 / 24 (less with an icon) | 8 (`rounded-md`) | 14 (12 at xs), 500 | 16 (12 at xs), gap 4 / 6 / 8 | 24 / 32 / 36 / 40 |
| **Stripe** (marketing) | from padding (≈ 48), compact ≈ 40 | 24 | 4 | 16, 400–500, 0 | gap 8 | unconfirmed |
| **Raycast** (site) | 36 (one size) | 12 | 8 | 14, 500, +0.2px | 16, gap 8 | unconfirmed |
| **Atlassian** (`@atlaskit/button` 25.7) | default 32, compact 24 | 12 (6 on the icon side) | 6 (4 compact) | 14, 500 | gap 4–6 | 32, 24 |
| **IBM Carbon** | 24 / 32 / 40 / 48 / 64 / 80 | 16 (64 on the trailing side with no icon) | 0 (a radius hook arrives behind a v12 flag) | 14, 400 | 16 | = height |
| **Material 3** (Compose tokens, 2025) | XS 32, S 40, M 56, L 96, XL 136 | 16 / 16 / 24 / 48 / 64 | round, or square 12 / 12 / 16 / 28 / 28; **morphs on press** | unconfirmed | 20 / 20 / 24 / 32 / 40, gap 8–16 | n/a |
| **Apple HIG** | iOS minimum 28, default 44 pt; macOS default 28, minimum 20 | unconfirmed | capsule / rounded rect | system | n/a | 44 pt hit region |

Takeaways:

- **The industry default is 32–36 px, not 44.** Radix, Geist, shadcn, Linear, Atlassian and Carbon all use
  32 (±4) for their default size and 24 for the smallest. A 44px *visual* is a "large" size everywhere
  except Material and iOS.
- **Every axis scales with size**: height, padding, radius (Radix 3→8, Geist 6→8), icon size and gap. The
  current SJButton scales only the font, which is the "amorphous" effect the owner sees.
- **The type is small and medium weight**: 12–14px at weight 500 (Linear 510). Semibold 16px, as today,
  is what reads as Bootstrap.
- **Width comes from padding about 3× the cap height**: 12–16px of padding-inline at 32–36px tall. That
  gives the long, compact silhouette the owner asked for.

### 2.2 Touch target versus a compact visual

- WCAG 2.2 **SC 2.5.8 (AA) requires only 24×24 CSS px**, or enough spacing that a 24px circle on each target
  does not intersect another target. SC 2.5.5 (AAA) is 44×44.
  <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>
- **Primer (GitHub)** keeps the visual compact. Under `@media (pointer: coarse)` it adds an invisible,
  centred, absolutely positioned `::after` with a 44px minimum (`minTouchTarget()` mixin; `@primer/css`
  `support/mixins/misc.scss`, `layout/app-frame.scss`).
- **Material Web** adds an invisible `<span class="touch">` (`height: max(48px, 100%)`, centred)
  (<https://github.com/material-components/material-web/blob/main/button/internal/_touch-target.scss>).
- **Apple** asks for a 44×44 pt hit region and allows smaller visuals (28 pt minimum control on iOS).
- Radix, Geist, Linear, shadcn, Stripe and Raycast **do not extend the hit area at all**. Their 24px size
  passes 2.5.8 at exactly 24.
- `pointer: coarse` is Baseline, widely available since 2018
  (<https://developer.mozilla.org/en-US/docs/Web/CSS/@media/pointer>).

### 2.3 Colour treatment

| System | Which tones get a solid fill | Neutral / near-black primary | Effects | Hover / press |
|---|---|---|---|---|
| Geist | default only | **yes**, gray-1000 near-black | none; borders drawn as a `0 0 0 1px` box-shadow | hover lightens; no press; 150ms |
| Linear | brand indigo `#5e6ad2`, plus a near-black "invert" CTA | invert variant | dark mode: glass, `inset 0 1px #ffffff0a` highlight | hover `brightness(115%)`, press **`scale(.97)`**, 160ms |
| Radix | every accent (accent-9), plus a "classic" variant | via accent | classic: layered gradients, inset highlights, an `::after` sheen; press drops the label 1–2px | hover accent-10; press `brightness(.92)` |
| shadcn | default (near-black in the neutral theme), destructive | **yes** | `shadow-xs` on outline | hover opacity 90% |
| Stripe | brand `#533afd` | no | none | colour only, 300ms |
| Raycast | light: grey fill with bevel insets; dark: white-alpha gradient | n/a | top/bottom inset bevels, glow | ring alpha changes |
| Atlassian | primary, warning, danger, discovery | default is a subtle neutral | none | separate hovered/pressed tokens |
| Carbon | primary, secondary, danger | secondary is dark grey | none | hover/active tokens |

Takeaways: **solid fills are rationed to primary, neutral (often near-black) and destructive.** Success,
warning and info solid buttons are rare (only Atlassian keeps warning). The "premium" signal comes from one
of three places: near-black restraint (Geist, shadcn), a 1px inner highlight with a subtle gradient (Linear,
Radix classic, Raycast), or excellent type and proportion on flat colour (Stripe).

Recommendation independent of direction: **ship solid only for primary, neutral and destructive.** Keep
success, warning and info as soft and outline (status buttons are rare; a green "Approve" can be
`soft success`). This fixes most of the "rustic" feel on its own.

### Sources (buttons)

- Radix Themes CSS: <https://github.com/radix-ui/themes/tree/main/packages/radix-ui-themes/src> (`components/_internal/base-button.css`, `button.css`, `icon-button.css`, `styles/tokens/space.css`, `radius.css`, `typography.css`)
- Vercel Geist: <https://vercel.com/geist/button> (live CSS bundles)
- Linear: <https://linear.app> (live CSS button module)
- shadcn/ui: <https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/new-york-v4/ui/button.tsx>
- Stripe: <https://stripe.com> (bundles at `b.stripecdn.com/mkt-ssr-statics`); Stripe Apps <https://docs.stripe.com/stripe-apps/components/button> (no pixel values published)
- Raycast: <https://www.raycast.com> (live CSS)
- Atlassian: <https://atlassian.design/components/button/usage>, `@atlaskit/button` 25.7.0 tarball (`dist/es2019/new-button/variants/shared/button-base.compiled.css`)
- IBM Carbon: <https://carbondesignsystem.com/components/button/style/>, <https://github.com/carbon-design-system/carbon/tree/main/packages/styles/scss/components/button>
- Material 3: <https://github.com/androidx/androidx/tree/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens> (`ButtonXSmallTokens.kt` … `ButtonXLargeTokens.kt`, `ShapeTokens.kt`)
- Apple HIG: <https://developer.apple.com/design/human-interface-guidelines/buttons>, <https://developer.apple.com/design/human-interface-guidelines/accessibility>
- WCAG 2.5.8: <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>
- MDN pointer: <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/pointer>

## 3. Fonts

The DS is MIT and self-hosts its fonts (woff2 committed and served, ADR-009, #52), so the font licence must
allow redistribution. In practice that means SIL OFL 1.1.

| Font | Licence | Variable | tnum | Notable features | Spanish | Arabic / Hebrew | Latin woff2 |
|---|---|---|---|---|---|---|---|
| **Geist** | OFL 1.1 | wght 100–900 | yes | ss01–ss11, case; Geist Mono sibling | full | none | ~29 KB |
| **Inter v4** | OFL 1.1 | wght 100–900 + **opsz 14–32** (Inter Display built in) | yes | cv01–cv14 (cv11 single-storey a), ss01–ss08, zero, case | full | none | ~73–89 KB |
| **Manrope** | OFL 1.1 | wght 200–800 | yes | case, frac; no stylistic sets | full | none | ~23 KB |
| **Plus Jakarta Sans** | OFL 1.1 | wght 200–800 | yes | ss01–ss03, case | full | none | ~27 KB |
| **Satoshi** (ITF) | **ITF Free Font License v2.0, not OFL** | wght 300–900 | yes | ss01–ss04 | full | none | n/a |
| **General Sans** (ITF) | **ITF FFL v2.0, not OFL** | wght 200–700 | **no** | ss01–ss03 | full | none | n/a |
| System stack | OS fonts, nothing shipped | SF / Segoe UI Variable are variable | OS | OS | yes | yes | 0 |

**Fontshare licence warning (Satoshi, General Sans).** The bundled `License/FFL.txt` lets you self-host the
fonts for *your own* sites and apps. Section 02 forbids making the files available to anyone else,
explicitly including through a "**repository**" or "publicly accessible servers", and forbids subsetting or
converting them without consent. Committing them to this public MIT repo or an npm package is **not
allowed**, so they are excluded. Sources: `https://api.fontshare.com/v2/fonts/download/satoshi` and
`…/general-sans` (`License/FFL.txt`); <https://www.indiantypefoundry.com/news/introducing-fontshare>.

**RTL companions (all OFL 1.1).**

- Arabic: **IBM Plex Sans Arabic** (static 100–700; the best grotesk match for Geist and Inter),
  **Noto Sans Arabic** (variable wght 100–900; matches Inter's range one-to-one, but ~166 KB),
  **Vazirmatn** (variable 100–900).
- Hebrew: **Noto Sans Hebrew** (variable 100–900, ~12 KB), **Heebo** (variable 100–900).
- **Rubik** is the only family that covers both Hebrew and Arabic, so it remains a usable RTL fallback.
- Load every RTL face with `unicode-range`, so Spanish and English users never download it. The
  prototype does exactly this.

Recommendation: **Inter v4** for the broadest UI feature set (tnum, zero, cv11, Inter Display through opsz
from one file) if the owner picks B. **Geist** if the owner picks A (smaller, more "engineered").
**Plus Jakarta Sans** if the owner picks C (warmer and more distinctive). Every option pairs with IBM Plex Sans
Arabic and Noto Sans Hebrew. The display family can be the same variable family at a heavier weight with
tighter tracking (or Inter's opsz 32). That removes Red Hat Display and one font download.

Font sources: <https://github.com/vercel/geist-font>, <https://rsms.me/inter/>, <https://github.com/rsms/inter>,
and the `METADATA.pb` of each family under <https://github.com/google/fonts/tree/main/ofl>.

**How the prototype fonts were obtained.** The variable woff2 files in
`apps/storybook/.storybook/static/fonts/proposal/` were downloaded once from the Google Fonts CSS2 API (the
same OFL binaries, subset to latin, arabic or hebrew), as `scripts/fetch-fonts.mjs` does for the current
fonts. Nothing loads remotely at runtime.

## 4. The three directions

Every direction keeps:

- Indigo 600 as the action colour; violet is never used on a control.
- AA contrast: 4.5:1 for text and 3:1 for boundaries, light and dark.
- A 2px focus outline with a 2px offset.
- A 24px minimum target everywhere, extended to 44px on coarse pointers.
- A true underlined `link` variant.
- An RTL row in Arabic and Hebrew.

| | **A. Graphite** | **B. Luminous Indigo** | **C. Soft Precision** |
|---|---|---|---|
| Reference | Geist, shadcn | Linear, Radix classic | Stripe, M3, Apple |
| Font | Geist 500, −0.006em | Inter v4 500, −0.011em, cv11 | Plus Jakarta Sans 600 |
| Heights xs/sm/md/lg | **24 / 28 / 32 / 40** | **24 / 32 / 36 / 44** | **28 / 32 / 40 / 48** |
| Padding-x | 8 / 10 / 12 / 16 | 8 / 12 / 14 / 20 | 10 / 12 / 16 / 24 |
| Radius | 4 / 6 / 6 / 8 | 6 / 6 / 8 / 10 | 8 / 8 / 10 / 12 |
| Font size | 12 / 13 / 14 / 14 | 12 / 13 / 14 / 15 | 12 / 13 / 14 / 16 |
| Icon / gap | 12–16 / 4–8 | 14–18 / 4–8 | 14–20 / 6–8 |
| Icon-only | 24 / 28 / 32 / 40 squares | 24 / 32 / 36 / 44 | 28 / 32 / 40 / 48 |
| Solid treatment | flat; near-black neutral is a peer of indigo | indigo base→700 gradient + 12% white sheen + 1px inner highlight + lift shadow; glow on hover | flat |
| Press | colour only | `scale(.97)`, inset press shadow | 1px down nudge |
| Native 44 without the hit-area trick | none (lg 40) | lg | lg |

Trade-offs, with the full list in each story's description:

- **A** is the densest and most "engineered" option, and the least branded. It needs a rule for when to use
  near-black versus indigo. All four sizes need the hit-area extension on touch.
- **B** has the most impact, especially on dark surfaces. It adds 4–5 shadow and gradient tokens. The
  skeuomorphic accent ages faster than flat (kept to 1px for that reason). Forced colours drop the effects,
  but the border remains.
- **C** is the friendliest and most comfortable, and needs the fewest new colour tokens. It is the least
  "dense SaaS". Flat colour leans entirely on the font.

### Contrast check (computed, WCAG relative luminance)

| Pair | Ratio |
|---|---|
| White on indigo 600 / on B sheen top (12% white over indigo 600) / on indigo 700 | 6.29 / **4.94** / 7.90 |
| White on red 600 / red 700 | 4.83 / 6.47 |
| Indigo 700 on indigo 200 (soft, pressed) · red 800 on red 200 | 5.30 · 5.74 |
| Outline borders on white: neutral `mix(slate 500 40%, slate 400)` / indigo 500 / red 500 | **3.24** / 4.47 / 3.76 |
| Dark: indigo 300 / red 300 text on slate 950 | 10.12 / 10.63 |
| Dark: slate 500 border / indigo 600 fill / indigo 400 focus vs slate 950 | 4.24 / 3.21 / 6.76 |

## 5. Token changes each direction would require

Values in the proposal stylesheet that already exist are referenced as tokens: the space scale, `radius.xs`
to `radius.lg`, `font.size.xs`/`sm`/`base`, `icon.size.sm`/`md`, the colour primitives, `shadow.sm`,
`target.min`/`floor` and the motion tokens. Every value marked NEW is listed here.

Common to all three:

- `font.family.sans` changes to the chosen family, plus RTL fallbacks; `font.family.display` is retired or
  aliased.
- **Component-level control tokens** (new `control.height.{xs,sm,md,lg}`, `control.padding-x.*`,
  `control.radius.*`, `control.font-size.*`, `control.icon.*`, `control.gap.*`), so inputs and selects can
  share the same heights.
- `font.size.ui` = 13px (0.8125rem). The scale has no 13.
- `icon.size.xs` = 12px and an `icon.size` of 16px. The icon scale is currently 14/20/24, with no 16, the
  most common button icon size.
- `space` half steps 6px and 10px (and 14px for B). Alternatively, keep them inside the control tokens only.
- `color.border.control` = slate 500 40% mixed into slate 400 (3.24:1), the lightest neutral outline border
  that still meets 3:1.
- `button.css`: drop the 44px `min-block-size` and use the hit-area `::before`; ration solid fills to
  primary, neutral and destructive.

Per direction:

| | NEW beyond the common set |
|---|---|
| A | `control.height.sm` 28, `tracking.ui` −0.006em. Rule: neutral solid is near-black slate 900 (a documented role, `color.action.neutral`). |
| B | `control.height` 36 and 44 (44 = `target.min`), `font.size` 15, `radius` 10, `icon.size` 18, `tracking.ui` −0.011em, `shadow.highlight` (inset 1px white 22%), `shadow.lift`, `shadow.glow`, `shadow.press`, `gradient.sheen` (white 12%), `motion.press.scale` 0.97. |
| C | `control.height.sm` 28 for xs, `radius` 10, `motion.press.offset` 1px. Colours need nothing beyond the common set. |

## 6. "As Link" versus a link variant

The current **As Link** story renders `SJButton href="…"`. That produces an `<a>` element styled as a button,
which is **legitimate polymorphism**. Navigation that should look like a call to action ("Start trial" going
to `/signup`) must be an anchor, for correct semantics (Enter only, opens in a new tab, shows the URL), and
must look like a button. So the story is right; only its name and the owner's expectation differ.

Recommendation:

1. Rename the existing story to **"As Anchor"**: "a button-styled `<a>`, used for navigation that looks
   like an action".
2. Add **`variant="link"`**: inline text, coloured by tone, **underlined at rest** (so meaning never relies
   on colour, SC 1.4.1), inheriting the surrounding font size, with no height, padding or minimum target
   inside a sentence (the 2.5.8 inline exception). It works on both `<a>` and `<button>`. The prototype
   shows it in a sentence and in the variant matrix, light and dark.

## 6b. Radius: the 2–4 px range (owner review of PR #124)

Owner feedback: the proposal has too much radius, and that costs elegance. The stories now have a
**Radius** control, defaulting to **Tight**. It overrides every direction, including the icon-only
squares, and the focus ring follows it because it is an `outline`, which follows `border-radius`:

| Option | xs | sm | md | lg |
|---|---|---|---|---|
| Proposal (current) | the direction's own values (A 4/6/6/8, B 6/6/8/10, C 8/8/10/12) | | | |
| **Tight** (default) | 2 | 3 | 4 | 4 |
| Sharp | 2 | 2 | 2 | 2 |
| None | 0 | 0 | 0 | 0 |

Where premium systems actually sit (primary sources, checked 2026-11-06):

| System | Button radius | In 0–4 px? |
|---|---|---|
| IBM Carbon | **0** (`$border-radius-00`); a `--cds-button-radius` hook is coming behind a v12 flag | yes (None) |
| Stripe (stripe.com `hds-button`) | **4** (`radius-sm`) | yes |
| Linear, `shape-square` | **4**; its marketing default is a pill | yes (square shape) |
| Atlassian `@atlaskit/button` | **4** compact, 6 default | compact only |
| Radix Themes, `radius="small"` | **2.25 / 3 / 4.5 / 6** for sizes 1–4 (factor 0.75 × 3/4/6/8); `radius="none"` gives 0 | xs–md, so it is almost exactly Tight |
| Vercel Geist (also vercel.com) | **6 / 6 / 8** | **no**: 6–8 |
| shadcn/ui | 8 (`--radius` − 2 by default; themeable) | no |

So the 2–4 px band is Stripe, Carbon (at 0), square Linear, compact Atlassian and Radix "small". Geist
and Vercel, often assumed to be sharp, actually sit at 6–8 px, the same as the current proposal. The
owner's preference matches the more editorial and financial end of the market (Stripe, IBM), and it
stays harmonious: Tight still scales slightly with height (2→4) so the small sizes do not look blunt.

Sources:
- Radix radius factors: <https://github.com/radix-ui/themes/blob/main/packages/radix-ui-themes/src/styles/tokens/radius.css>
- Carbon: <https://github.com/carbon-design-system/carbon/tree/main/packages/styles/scss/components/button> (`_radius.scss`)
- Stripe: <https://stripe.com> (live `hds-button` CSS)
- Linear: <https://linear.app> (live button CSS, `shape-square`)
- Atlassian: `@atlaskit/button` 25.7.0 (`button-base.compiled.css`)
- Geist: <https://vercel.com/geist/button>
- shadcn: <https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/new-york-v4/ui/button.tsx>

**Token mapping.**

| Value | Existing token | Status |
|---|---|---|
| 0 | `radius.none` (`0`) | exists |
| 2 px | none | **NEW**, e.g. `radius.2xs` = 0.125rem |
| 3 px | none | **NEW**, e.g. `radius.control-sm` = 0.1875rem (or round sm up to 4 and drop it) |
| 4 px | `radius.xs` (0.25rem) | exists |

Tight therefore needs two new values (2 and 3). Sharp needs one (2). None needs nothing new. Either way,
the token description of `radius.sm` (6 px, "Signature control radius. Buttons…") would change: the
signature control radius becomes 4 px (`radius.xs`), or a new `control.radius.*` scale is added.

## 7. Recommendation

**Direction B (Luminous Indigo) with Inter v4**, at **Tight** radius (2/3/4/4), plus decision 2(a) and the rationed solid fills.

- The owner's stated target is high-visual-impact apps. B is the only direction that reads as crafted on
  dark and light surfaces without extra art, while the brand stays Indigo 600.
- Its sizes (24/32/36/44) match the industry median (shadcn, Geist, Linear), and its lg is exactly
  `target.min`, so primary CTAs on mobile need no hit-area trick.
- Inter v4 has the deepest UI feature set (tnum, cv11, opsz as Inter Display) under OFL, and pairs cleanly
  with IBM Plex Sans Arabic and Noto Sans Hebrew.
- Risk: the effects add about five tokens. If they prove too much in product, B degrades gracefully to
  C-style flat by setting `shadow.highlight` and `gradient.sheen` to none, with no structural change.

## 8. Decisions for the owner

1. **Direction**: A, B or C, or a blend, and a **radius** option: Tight, Sharp or None. A common blend is C's proportions with B's solid treatment.
2. **Touch target**: the current rule is a 44px visual minimum on every size. Options:
   - **(a) Recommended.** 24px minimum hit area everywhere (WCAG AA), extended to 44px by an invisible
     `::before` under `@media (pointer: coarse)`, as Primer and Material Web do. Cost: on touch, adjacent
     compact buttons need about `(44 − h) / 2` px each side, so roughly 16px gaps for 28px buttons in
     toolbars, or the extensions overlap and the nearest one wins.
   - **(b)** Bump the visual size on coarse pointers (md becomes 44 on touch). Simpler, but layouts shift
     between devices.
   - **(c)** Keep a 44px visual everywhere (today). This is the cause of the amorphous look.
3. **Solid tones**: ration solid fills to primary, neutral and destructive (recommended).
4. **Font**: Geist, Inter or Plus Jakarta Sans (all OFL). Satoshi and General Sans cannot be self-hosted in
   this repo.
5. **Link**: approve renaming "As Link" to "As Anchor" and adding `variant="link"`.
