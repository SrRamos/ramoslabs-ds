# Pattern research, 2026-11

Validation of the owner-approved pattern decisions (items 1-12 and the three Discard items) against
primary sources. Item 13 (SJSkeleton) is out of scope here.

Method: every URL below was opened in this session and returned real content, unless a line says
otherwise. Where a page failed or returned only a title, that is stated under "Not verified". Quotes
are avoided; each source line is a short paraphrase. Date of research: 2026-11-06.

## Flags

These are the places where a source contradicts a decision or materially qualifies it. They are not
softened.

1. Floating labels (Discard 1): the stated rationale is NOT supported. The decision says "NN/g and
   Baymard report more errors". NN/g calls floating labels a "partial fix" that keeps some placeholder
   drawbacks (empty-looking fields, confusion with default values, unreliable assistive-tech support).
   Baymard (2013) calls them "promising", says they have "yet to be extensively tested" and that there
   is "no in-depth usability testing"; its only warning is to build the error state with care. Neither
   source reports a measured error increase. The Avoid rule is still defensible (NN/g's recommendation
   is a label above the field; GOV.UK says the same; Baymard says forms with 3+ fields should use
   separate labels), but the Why text must be rewritten. The "~12px label" detail is not from a
   primary source I opened.
2. Borderless grey inputs (Discard 2): WCAG 1.4.11 is overstated. The W3C Understanding page says a
   control needs no visible boundary if text or an icon already identifies it; the boundary only needs
   3:1 when it is the sole cue. It also lists a borderless input distinguished by a 3:1 background
   fill as a PASS. So "fails 1.4.11" is true only if the fill/border is the only identifier and sits
   near 1.2:1. The Avoid rule is sound as house policy (identifiability, low vision, glare) but must
   not claim a flat WCAG failure for every label-bearing filled input. Re-read the normative SC text
   before the docs say "fails".
3. Input heights 48px and 56px (item 7): no primary source states 48 or 56 px for web text fields.
   The principle (touch targets bigger than the 24px floor, about 44-48) is well sourced; the exact
   numbers, and the claim that fields should be taller than buttons, are house design judgement.
   Material "56dp" could NOT be verified from an official Material page (m3.material.io returned only
   a title; the Compose `TextFieldDefaults` reference page opened but its `MinHeight` value was not in
   the text I received). Secondary search results (Flutter and AndroidX commit threads) describe 56dp
   as the Material 3 field height, and one forum post claims the Material spec says 48dp. Treat 56dp
   as "widely implemented, not confirmed from the spec" and do not cite it as a Material rule.
4. Grouped formatting (item 10): GOV.UK CONTRADICTS the phone-number half. Its telephone pattern says
   do not use input masking and do not reformat a number after entry (Notify users were confused when
   a +44 was added). Its text-input pattern says do not use `maxlength`. Baymard SUPPORTS grouping for
   card numbers (allow spaces and auto-format them as typed). So the rule must split: grouped
   rendering of READ-ONLY values is fine; editable fields may auto-format only for card numbers, and
   never mask or reformat phone numbers. No source opened covers IBAN or local account-number grouping.
5. Sticky full-width bottom CTA (item 11): WCAG 2.4.11 (Focus Not Obscured, AA) qualifies it. A sticky
   footer must not fully hide the focused control; the rule needs `scroll-padding-bottom` equal to the
   bar height. I found no NN/g or Baymard article on sticky CTAs (search surfaced only vendor blogs),
   and "full-width" is not sourced anywhere. Thumb-zone evidence (Hoober) supports bottom placement
   but dates from 2013.
6. Bottom navigation (item 12): the centre-action caveat has NO supporting source. NN/g's navigation
   article does not discuss a centre/FAB action. Apple's tab-bar page and Material's navigation-bar
   page returned only a short summary or title (see Not verified), so "filled icon for the active
   tab" and "3-5 destinations" are confirmed only by NN/g (about 5 max) and the Material summary line.
7. Small icon buttons (item 5): the media query. The first decision said `@media (pointer: coarse)`, but
   `pointer` reports only the primary input. On hybrid devices (touch laptop, tablet with trackpad) the
   primary pointer can be fine while touch is still used, so `pointer: coarse` misses touch users. Resolved:
   the DS uses `@media (any-pointer: coarse)`, as web.dev does. Also
   note WCAG 2.5.8 only requires 24px (or spacing); 44px is the AAA 2.5.5 level and 48px is web.dev
   and Android's figure, so "44" is a design choice at the strict end, not a WCAG requirement.
8. One hero figure (item 1): NN/g's visual-hierarchy article is page-level and says to limit large
   elements to two so they still stand out and to keep one dominant focal element. "One hero per
   card" is an extension of that, not a stated rule.
9. Plus Jakarta Sans `tnum` (item 2): not verified in this research (font file not inspected). MDN
   confirms `tabular-nums` has no effect if the font lacks the `tnum` feature.

## Not verified (fetch failed or content-free)

- Apple HIG pages (tab-bars, buttons, text-fields, layout, accessibility): fetched, but the tool
  returned only the page title and a one-line summary; nothing was confirmed from them. The only Apple
  page that returned real text is the "UI Design Dos and Don'ts" tips page (44 x 44 pt).
- Material 3 pages (m3.material.io text-fields specs, navigation-bar guidelines): title or a one-line
  summary only. Not used as evidence beyond the summary line noted in item 12.
- WCAG 2.5.5 Understanding page: request failed (socket hang up). The 44 x 44 AAA figure is taken from
  the 2.5.8 Understanding page, which states it.
- Baymard `input-mask-format-input` and `placeholders-in-form-fields-are-harmful`: returned only a
  paywall header. Not used.
- GOV.UK `designing-for-the-web` page: HTTP 404. GOV.UK frontend `_index.scss`: no sizes in the file
  (they live in a mixin I did not open), so GOV.UK input height was not established.
- Material Web `tokens/.../_md-comp-outlined-text-field.scss`: HTTP 404.
- Hoober's original publications: only the A List Apart excerpt was opened.

---

## 1. Card information hierarchy (one hero figure per card)

Decision: one hero figure per card, a row of label/value metrics, then a visual or tertiary block.

Recommended: give each card a single dominant figure, then smaller secondary metrics.
Rule: one hero figure per card; every other number is one or more steps smaller.
Why: the eye needs one entry point; two equally large numbers compete and neither is read first.

Avoid: two or more same-size headline numbers on one card.
Rule: do not give two figures the same size, weight and colour emphasis.
Why: equal emphasis removes the focal point and the card reads as clutter.

Sources
- "Visual Hierarchy in UX: Definition", NN/g. https://www.nngroup.com/articles/visual-hierarchy-ux-definition/
  Says hierarchy comes from size, contrast and a dominant element; many equally emphasised elements
  leave no focal point; limit large elements to about two; do not rely on colour alone.

Verdict: PARTIAL. The principle (one dominant element, no competing emphasis) is confirmed. The
source is page-level and permits up to two large elements, so "exactly one per card" is the DS's
stricter house rule. See Flag 8.

## 2. Metric typography (number plus muted unit, tabular-nums)

Decision: large number, smaller muted unit, baseline aligned, `font-variant-numeric: tabular-nums`,
unit no lighter than slate-500, verify Plus Jakarta Sans ships `tnum`.

Recommended: tabular figures for any metric that updates or sits in a column; unit one step down.
Rule: set `tabular-nums` on metrics and keep unit text at or above the slate-500 floor.
Why: equal-width digits stop values shifting as they change and let columns align; a lighter unit
keeps hierarchy without dropping below the contrast floor.

Avoid: proportional figures on live or compared numbers; units as light grey below 4.5:1.
Rule: no metric without `tabular-nums`; no unit lighter than slate-500 on white.
Why: layout jitter on update, and muted text below the floor fails WCAG 1.4.3.

Sources
- "font-variant-numeric", MDN. https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric
  `tabular-nums` makes digits equal width so they align; useful for tables, timers, counters; it maps
  to the font's `tnum` feature, so it only works if the font has it.
- "Visual Hierarchy in UX: Definition", NN/g (URL in item 1). Supports size and contrast as the means
  of ranking number versus unit; warns against colour alone.

Verdict: PARTIAL. `tabular-nums` is CONFIRMED. Number-plus-smaller-unit has no direct primary source,
it follows from general hierarchy guidance. The Plus Jakarta Sans `tnum` check is still open (Flag 9);
if the font lacks it, document the fallback.

## 3. Proximity: context next to the datum

Decision: context and metadata sit next to the datum they explain.

Recommended: place a label, chip or note adjacent to the value it qualifies.
Rule: if a piece of context explains one datum, it sits in that datum's group, not in a header.
Why: closeness is read as relation; distant context is missed or attached to the wrong thing.

Avoid: parking explanatory context in a header or footer far from its datum.
Rule: do not separate a value from its qualifier by more than the within-group gap.
Why: items stranded far from their related content are easy to miss.

Sources
- "Proximity Principle in Visual Design", NN/g. https://www.nngroup.com/articles/gestalt-proximity/
  Items placed near each other read as related; a larger gap marks separate groups; proximity can
  outweigh colour or shape; stranded items are easy to miss.
- "What is the Proximity Principle", IxDF. https://ixdf.org/literature/topics/proximity-principle
  Gestalt grouping: close elements are seen as related; UI examples include price next to the buy
  button and field labels next to fields.

Verdict: CONFIRMS.

## 4. Metadata line (separator and `<time datetime>`)

Decision: items joined by an aria-hidden bullet; relative time in `<time datetime>`.

Recommended: `<time datetime="2026-11-06T09:12:00-05:00">hace 2 h</time>` with machine-readable value.
Rule: wrap every date or relative time in `<time>` with a valid `datetime`; hide decorative
separators from assistive tech.
Why: the attribute gives software an unambiguous value while people read friendly text; a bullet read
aloud adds noise.

Avoid: relative time as bare text; separators as spoken characters.
Rule: no bare "2 h ago" text, no unhidden bullet glyphs.
Why: bare relative text has no machine value and goes stale; spoken bullets interrupt the line.

Sources
- "<time>", MDN. https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/time
  `datetime` holds the machine-readable form of the displayed text; lists valid formats (date,
  local and global date-time with offset, duration, week); text without the attribute must be a valid
  value.
- HTML Standard, "The time element", WHATWG. https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-time-element
  `datetime` is optional; with it the content is phrasing content; valid forms match MDN's list.

Verdict: PARTIAL. `<time datetime>` is CONFIRMED. The bullet separator and `aria-hidden` have no
primary source opened; they are a DS convention (decorative content is hidden from AT as standard
practice, but not cited here). Placement in Voice & Tone is a docs decision.

## 5. Small icon buttons (invisible 44px hit area)

Decision: visually small overflow button keeps a 44px+ invisible hit area on coarse pointers.

Recommended: keep the glyph small, enlarge the target with padding or a pseudo-element on coarse
pointers.
Rule: every pointer target is at least 44 x 44 CSS px on coarse pointers, whatever the glyph size.
Why: fingertips are about 1.6-2 cm wide; small targets cause mistaps and fail motor-impaired users.

Avoid: a 16-24px glyph as the whole target; adjacent small targets with no gap.
Rule: no undersized target without padding; keep adjacent hit areas from overlapping.
Why: mistaps and overlapping hit areas trigger the wrong action.

Sources
- "Understanding SC 2.5.8 Target Size (Minimum)", W3C. https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
  AA floor is 24 x 24 CSS px; smaller targets pass only with a clear 24px circle around them; the
  stricter 2.5.5 sets 44 x 44 with no spacing exception.
- "Accessible tap targets", web.dev. https://web.dev/articles/accessible-tap-targets
  Recommends 48 x 48 px with about 8px between targets; a 24px icon can get padding to reach 48; uses
  `any-pointer: coarse` to enlarge only for touch.
- "Touch target size", Google Accessibility Help. https://support.google.com/accessibility/android/answer/7101858
  Android: 48 x 48 dp minimum, 8dp apart; hit area may exceed the visible icon.
- "UI Design Dos and Don'ts", Apple. https://developer.apple.com/design/tips/
  Controls at least 44 x 44 points.
- "Touch Target Size", NN/g. https://www.nngroup.com/articles/touch-target-size/
  1 cm x 1 cm minimum, larger for primary actions; about 2 mm between targets; space does not fix
  targets that are too small.

Verdict: CONFIRMS the principle and the 44px figure (Apple, WCAG 2.5.5). Note web.dev and Android use
48; and see Flag 7 on `pointer` versus `any-pointer`.

## 6. Spacing rhythm (semantic tokens)

Decision: less space inside a group, more between groups; add `space-related` < `space-group` <
`space-section`; add a lint where detectable.

Recommended: three semantic gaps layered on the numeric scale.
Rule: the gap between groups is always larger than the gap inside a group.
Why: spacing alone tells the reader what belongs together; equal gaps flatten the structure.

Avoid: the same value for inner and outer spacing.
Rule: never use one spacing value both within and between groups of the same layout.
Why: identical gaps erase grouping, and responsive collapse can merge groups.

Sources
- "Proximity Principle in Visual Design", NN/g (URL in item 3). More space between unrelated groups
  than within; responsive layouts can collapse gaps and change grouping, so check each breakpoint.
- "What is the Proximity Principle", IxDF (URL in item 3). Keep related items tight, add noticeably
  more space between groups; its sketch exercise used roughly 3-4 times the gap (an exercise, not a
  rule).

Verdict: CONFIRMS the principle. The semantic token names and the lint have no external source; they
are DS implementation. The 3-4 ratio is illustrative only.

## 7. Input height (48px, 56px coarse)

Decision: default 48px; 56px under `@media (any-pointer: coarse)`; fields taller than compact buttons.

Recommended: fields at or above the strict touch minimum, taller on touch.
Rule: text inputs are at least 44px on any pointer and larger on coarse pointers.
Why: a field is tapped, read and corrected, so a bigger target and text area reduce mistaps and
make edited text readable.

Avoid: 32-40px fields on touch layouts.
Rule: no input shorter than the target-size floor of its pointer class.
Why: undersized fields cause mistaps and hide the caret and text on small screens.

Sources
- Understanding SC 2.5.8, W3C (URL in item 5): 24px AA floor, 44px AAA.
- "Accessible tap targets", web.dev (URL in item 5): 48 x 48 px.
- Android touch targets, Google Accessibility Help (URL in item 5): 48dp.
- "UI Design Dos and Don'ts", Apple (URL in item 5): 44 pt.
- "Touch Target Size", NN/g (URL in item 5): 1 cm physical.
- "Text fields", Material Web docs (raw). https://raw.githubusercontent.com/material-components/material-web/main/docs/components/text-field.md
  Opened; filled and outlined are functionally identical and differ visually. It states no height.
- TextFieldDefaults, Jetpack Compose Material 3 reference. https://developer.android.com/reference/kotlin/androidx/compose/material3/TextFieldDefaults
  Opened; lists `MinHeight` as the default minimum height of a TextField but the value was not in the
  text received. Not a confirmation of 56dp.

Verdict: PARTIAL. The principle (fields must clear 44-48px on touch) is CONFIRMED. The specific
48px/56px values and "fields taller than buttons" are house judgement; Material 56dp is not
verified from an official page (Flag 3).

## 8. One question per screen

Decision: one question per screen in multi-step flows, question as the heading.

Recommended: one question (or one piece of information) per page, with the question as the page
heading, set as the label or legend.
Rule: start with one thing per page; combine only when research shows it helps.
Why: users focus on one answer, find their way through an unfamiliar process, recover from errors
easily, and it suits mobile.

Avoid: long multi-question pages by default.
Rule: do not group questions unless research shows repeat users switch tasks quickly.
Why: a long page hides the structure and makes errors harder to locate.

Sources
- "Question pages", GOV.UK Design System. https://design-system.service.gov.uk/patterns/question-pages/
  Start with one question per page; using the label or legend as the heading means screen readers
  announce it once; grouping is an exception that research should justify (for example, expert
  internal users).
- "Form structure", GOV.UK Service Manual. https://www.gov.uk/service-manual/design/form-structure
  Split forms so each page has one thing; benefits listed: focus, wayfinding, mobile fit, error
  recovery, plus save-as-you-go and per-question analytics. Titles may be a question or a statement
  but should stay consistent.
- "Wizards", NN/g. https://www.nngroup.com/articles/wizards/
  One wizard page typically maps to one step; show the full sequence, highlight the current step,
  mark completed steps, name the next step on the button.

Verdict: CONFIRMS. Note GOV.UK allows a statement heading where several questions share a page.

## 9. Stepper and flow progress ("1 de 3" plus segmented bar)

Decision: a text label ("1 de 3") plus a segmented bar; the text is mandatory.

Recommended: step count in text alongside the bar; mark the current and completed steps with more
than colour.
Rule: every progress indicator carries a text label ("Step X of Y"); the bar never stands alone.
Why: colour-only state fails users who cannot distinguish it, and a count tells people how much is left.

Avoid: a bar of coloured segments with no text; a bare "Loading..." with no count.
Rule: no progress UI whose state is carried by colour alone.
Why: it fails WCAG 1.4.1 and gives no sense of remaining effort.

Sources
- "Understanding SC 1.4.1 Use of Color", W3C. https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
  Colour must not be the only visual means of conveying information; pair it with text, an icon or
  shape. (The page does not mention progress bars; applying it to steps is an inference.)
- "Progress Indicators Make a Slow System Less Insufferable", NN/g. https://www.nngroup.com/articles/progress-indicators/
  Show step counts rather than only a percentage; pair with text such as "3 of 50"; avoid static
  text with no progress information. Note: this article is about waiting, not form wizards.
- "Wizards", NN/g (URL in item 8). Show all steps, highlight the current one, label them.

Verdict: CONFIRMS the principle. The exact "1 de 3" plus segmented bar format is a DS design; the NN/g
progress article is about wait indicators, so cite it for the "X of Y" text idea only.

## 10. Grouped display formatting (account, card, phone numbers)

Update (dark-theme PR): the owner chose to follow GOV.UK for every editable number. Nothing is reformatted while the
user types; the grouped display appears on blur and in read-only views; the submitted value is raw digits.
The earlier "auto-format card numbers as typed" half (Baymard) is superseded.

Decision: grouped display (`0123 4567`), display only; the submitted value is unchanged; ties to
ADR-007 kinds.

Recommended: group digits in read-only displays; in card inputs allow spaces and auto-format; set
the right `autocomplete` token.
Rule: store and submit the raw digits; show groups for reading; never reject spaces.
Why: people read and check numbers in blocks (the printed card layout), and rejecting spaces
creates false errors.

Avoid: masking or reformatting phone numbers in inputs; `maxlength` caps; stripping spaces from view.
Rule: accept any reasonable format, normalise before validating, do not reformat what the user typed.
Why: masks break pasting and the user's own format; reformatting confused users in GOV.UK testing.

Sources
- "The Credit Card Number Field Must Allow and Auto-Format Spaces", Baymard. https://baymard.com/blog/credit-card-field-auto-format-spaces
  Allow spaces, never strip them or error on them; auto-format as typed using the detected card type
  pattern; do not cap length; users check numbers in the printed 4-digit blocks. Says 15% of sites
  still do not auto-format (50% in 2019).
- "Telephone numbers", GOV.UK Design System. https://design-system.service.gov.uk/patterns/telephone-numbers/
  Allow spaces, hyphens and brackets; avoid input masking and avoid reformatting after entry; use
  `type="tel"` and `autocomplete="tel"`.
- "Text input", GOV.UK Design System. https://design-system.service.gov.uk/components/text-input/
  Do not use `maxlength`; normalise input before validating; extra letter spacing helps with
  codes such as account numbers; use `inputmode="numeric"` and avoid `type="number"` for such
  fields; set `autocomplete` and `spellcheck="false"` where right.
- "autocomplete", MDN. https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete
  `cc-number` is the card or other payment-method number; `tel` is a full phone number; related
  `cc-exp`, `cc-csc`, `tel-national` tokens exist.

Verdict: PARTIAL. See Flag 4. Baymard CONFIRMS card grouping; GOV.UK CONTRADICTS masking phone numbers
in inputs. The rule must say "display-only grouping for read-only values; input masking only for
card numbers". No source opened covers IBAN or account-number grouping.

## 11. Full-width sticky bottom CTA on mobile

Decision: full-width sticky bottom CTA on mobile (reinforce in the mobile-first pattern).

Recommended: pin the primary action to the bottom, add scroll padding.
Rule: the primary mobile action sits in the bottom thumb zone; a sticky bar never hides the focused
control (`scroll-padding-bottom` equals bar height).
Why: the bottom is where thumbs reach, and a fixed bar can otherwise cover keyboard focus.

Avoid: a primary action only at the top of a long form; stacking several sticky bars.
Rule: one sticky bar at a time; keep chrome small relative to content.
Why: top corners are the hardest to reach and persistent chrome eats scarce screen space.

Sources
- "How Do Users Really Hold Mobile Devices / How We Hold Our Gadgets" (Hoober excerpt), A List Apart.
  https://alistapart.com/article/how-we-hold-our-gadgets/
  Based on 1,300+ observed users: thumbs do about 75% of taps; only about a third of the screen is
  easy to reach, at the bottom on the side opposite the thumb; top corners are hardest. Dates from 2013.
- "Understanding SC 2.4.11 Focus Not Obscured (Minimum)", W3C. https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
  A sticky footer must not fully cover the focused element; scroll-padding is a passing technique.
- "Mobile UX", NN/g. https://www.nngroup.com/articles/mobile-ux/
  Downplay chrome to keep a high content-to-chrome ratio. It does NOT discuss sticky buttons or
  thumb reach.
- "Touch Target Size", NN/g (URL in item 5): larger targets for primary CTAs (about 2 cm).

Verdict: PARTIAL. Thumb reach supports bottom placement; WCAG 2.4.11 qualifies the pattern (Flag 5).
No primary source found for "full-width" or for sticky-CTA conversion benefit; only vendor blogs
turned up in search and they are not cited.

## 12. Bottom navigation (labels, filled active icon, centre action)

Decision: icon plus visible label; active tab uses filled icon plus colour; optional centre action
only if it is THE primary action, with an accessible name and visible label.

Recommended: 3-5 destinations, each with a visible label; mark the active tab with more than colour.
Rule: no unlabeled icon in primary navigation; active state = filled icon (or indicator) plus colour.
Why: most icons have no standard meaning, and colour alone fails WCAG 1.4.1.

Avoid: icon-only tabs; more than about five tabs; hiding labels on inactive tabs.
Rule: do not drop labels, do not exceed five destinations.
Why: labels remove guesswork and more tabs shrink touch targets below usable size.

Sources
- "Icon Usability", NN/g. https://www.nngroup.com/articles/icon-usability/
  A text label must accompany an icon; labels should be visible at all times; even standard icons
  benefit.
- "Mobile Navigation Patterns", NN/g. https://www.nngroup.com/articles/mobile-navigation-patterns/
  Tab bars suit few options; beyond about five it is hard to keep targets large; labeled icons are the
  recommended best practice; tab bars persist while scrolling. Does not discuss a centre action.
- "Understanding SC 1.4.1 Use of Color", W3C (URL in item 9): pair colour with another cue.
- "Navigation bar", Material Design 3. https://m3.material.io/components/navigation-bar/guidelines
  Only a summary line was returned: 3 to 5 destinations, each with an icon and text label, and an
  active indicator on the current one. Thin evidence.

Verdict: PARTIAL. Visible labels and the 3-5 limit are CONFIRMED (NN/g, Material summary). Filled-icon
active state is not confirmed from an opened Apple page (Flag 6). The centre-action caveat is an
unsourced DS rule.

## Discard 1. Floating labels inside the field

Decision: keep the label above the field.

Recommended: a persistent label above the input.
Rule: the label is always visible, outside the field, in the same position empty or filled.
Why: a label that stays put keeps context while typing and when correcting errors.

Avoid: labels that start inside the field and move on focus.
Rule: no floating, inline or placeholder-as-label patterns.
Why: they keep the empty-looking-field and default-value confusion of placeholders, and the label
shrinks and moves.

Sources
- "Placeholders in Form Fields Are Harmful", NN/g. https://www.nngroup.com/articles/form-design-placeholders/
  Placeholders vanish while typing, empty-looking fields draw less attention and read as prefilled;
  floating labels are a partial fix with remaining drawbacks; best practice is a label above.
- "Mobile Forms: Avoid Inline Labels", Baymard (2013). https://baymard.com/blog/mobile-forms-avoid-inline-labels
  Inline labels remove context and make errors harder to fix; forms with 3+ fields should use
  separate labels; floating labels are promising but untested, and the error state needs care.
- "Text input", GOV.UK Design System (URL in item 10). Align labels above the input.
- "Text field", Material Web docs (URL in item 7). Filled and outlined are functionally identical, a
  visual choice; no stance on floating.

Verdict: PARTIAL. The rule is supported; the stated reason (more errors reported) is not. See Flag 1.

## Discard 2. Borderless grey-filled inputs

Decision: keep the slate-500 border; a borderless grey fill has about 1.2:1 boundary contrast.

Recommended: a visible border at least 3:1 against the adjacent background.
Rule: the field boundary (border, or a fill) meets 3:1 against its surroundings.
Why: the boundary is how people find the field; low vision, glare and bright screens make 1.2:1 vanish.

Avoid: a pale fill at about 1.2:1 with no border as the only identifier.
Rule: no input whose only affordance is a sub-3:1 fill.
Why: where the boundary is the only cue, it must reach 3:1 or the field is not identifiable.

Sources
- "Understanding SC 1.4.11 Non-text Contrast", W3C. https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
  UI component boundaries and states need 3:1 where needed to identify them; a visible boundary is
  not required if text or an icon already identifies the control; a borderless input with a 3:1
  background fill passes; a light-grey (#AAA) border with no other cue fails.
- "Understanding SC 2.4.7 Focus Visible", W3C. https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html
  Keyboard focus must be visible; focus indicators also fall under 1.4.11.

Verdict: PARTIAL. Keep the Avoid rule, but the Why must say "where the fill or border is the only
cue", not "always fails 1.4.11" (Flag 2). The DS's slate-500 border is a stricter, safer policy than
the WCAG minimum.

## Discard 3. Black pill CTA

House design decision, no external source. The action colour is Indigo 600 (the brand primary) and
the approved radius is 6-10px, so a black, fully rounded pill breaks both the colour and shape
tokens.

Recommended: primary CTA in the action colour at the approved radius.
Rule: the primary action uses the Indigo 600 token and a radius from the approved scale.
Why: one action colour and one shape language keep actions recognisable across the product.

Avoid: a black, fully rounded pill as the primary CTA.
Rule: no off-token CTA colour or pill radius.
Why: it introduces a second action language the DS does not own.

Verdict: HOUSE DECISION (not externally validated).

---

## Verdict summary

| # | Decision | Verdict |
|---|---|---|
| 1 | One hero figure per card | PARTIAL |
| 2 | Metric typography | PARTIAL |
| 3 | Proximity of context | CONFIRMS |
| 4 | Metadata line and `<time>` | PARTIAL |
| 5 | Small icon buttons, 44px hit area | CONFIRMS (see Flag 7) |
| 6 | Spacing rhythm | CONFIRMS (tokens and lint are DS work) |
| 7 | Input height 48/56 | PARTIAL |
| 8 | One question per screen | CONFIRMS |
| 9 | Stepper text label | CONFIRMS (principle) |
| 10 | Grouped display formatting | PARTIAL (GOV.UK contradicts input masking) |
| 11 | Sticky bottom CTA | PARTIAL |
| 12 | Bottom navigation | PARTIAL |
| D1 | Floating labels | PARTIAL (reason unsupported) |
| D2 | Borderless grey inputs | PARTIAL (WCAG overstated) |
| D3 | Black pill CTA | HOUSE DECISION |

## Addendum: Plus Jakarta Sans tnum (item 2, Flag 9)

Verified in Chromium against the self-hosted variable font (700 weight, 36px): with `font-variant-numeric: tabular-nums` the strings "1111" and "8888" are both 86.41px wide; with the default figures they are 57.97px and 90.98px. The font ships `tnum`, so no fallback is needed. Re-run by loading the Activity Card story and measuring text widths.
