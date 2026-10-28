# G2-FIX-D notes (SHOULD-5: one luminance implementation)

- tokens.test.ts, worker `check_contrast` and TokenPicker.vue now import `contrastRatio` / `relativeLuminance` from `packages/testing/contrast/wcag.js` (relative path; wcag.js directly, not the index, which pulls node-only token loading). No export change needed.
- Threshold: copies used 0.03928, shared uses 0.04045 (WCAG 2.2 corrected value). No 8-bit channel v/255 falls in (0.03928, 0.04045], so results are bit-identical; proven in tokens.test.ts for all 256 grays and every color-token pair.
- Worker keeps its own hex validation (rejects #rgba/#rrggbbaa as before) and passes normalized #rrggbb to the shared ratio. TokenPicker keeps its `#`-optional regex.
- Verified: astro build, wrangler dev `check_contrast` primary on white = 6.29 AA, color-picker page screenshot renders with 6.29:1.
