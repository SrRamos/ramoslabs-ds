# S-CON-4 notes: AT honesty scan (W1-319)

## What shipped
- `packages/testing/honesty/index.js` (pure scan), `cli.js` (file walk), `index.test.js` (26 tests).
- Shared-file touch: root `package.json` gains `"honesty:check": "node packages/testing/honesty/cli.js"` and
  `&& bun run honesty:check` appended to `gate`. The row names no script, so the default name is used.
- `ci.yml` is untouched (W1-314 owns it and lists W1-319 as a dependency).

## Rules (ADR-010 honesty gate, ADR-015, D2)
Data (any object with a string `test_status`, in contracts and registry JSON):
- `tested-real` needs `tested_on` (YYYY-MM-DD) and a non-empty `log`.
- Only `voiceover` may be `tested-real`; NVDA, JAWS and TalkBack never.
- `tested_on` or `log` on a non-`tested-real` entry fails.
Wording (sentence level, over md/json/txt/astro/ts/js/html):
- A sentence naming NVDA, JAWS, TalkBack or `evidence-only` plus tested/verified/certified/validated fails,
  unless the sentence also negates, defers or defines it (not, never, until, pending, optional, ...).
- A VoiceOver sentence making the same claim fails when no valid `tested-real` VoiceOver entry exists in the data.
- Status tokens (`tested-real`, `pending-real-test`, `tested_on`, "real-test lane") are neutralised first.

## Scope scanned
`packages/contracts/contracts`, `docs/`, `apps/site/{src,agentic,public}`, root `llms.txt`, `llms-full.txt`,
`registry.json`, `README.md`, `AGENTS.md`. Skips node_modules, dist, .astro, .turbo, coverage.

## Decisions and caveats
- `docs/architecture/audits/**` is exempt: audit records review sources ("verified" there describes source
  checks, not AT testing claims). This is a policy choice; remove `EXEMPT` in `cli.js` to include them.
- "certification" as a noun is not a claim word (ADR-015 defines wave-1 certification as evidence-conformant
  for the evidence-only ATs); "certified" is.
- The negation list is a heuristic; it errs toward permitting defined/deferred wording. Direct claims fail.
- MCP output and generated site output (dist) are not on disk in source form; the scan covers their sources.
  A scan of built output belongs to W1-314 once it wires the build artefacts.

## Result on today's tree
0 violations (147 files). No real violations were found in existing files.
