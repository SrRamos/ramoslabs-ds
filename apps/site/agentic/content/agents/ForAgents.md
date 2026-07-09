---
id: agents
title: For Agents
group: agents
summary: Agent-native, MCP-first, AI-ready by design — the machine-readable contract that lets any agent build against this system with typed, verifiable tools instead of scraped HTML
---

Agent-native. MCP-first. AI-ready by design. This design system is built to be consumed by an AI agent, not just read by a human. Every rule, token, and pattern is available as machine-readable data and as typed, verifiable tools, so an agent builds against the contract instead of guessing from rendered HTML.

## The contract, in one place

Six artifacts make the whole system legible to a machine. All are served from the site root and are free to fetch, read-only, and need no auth.

- **MCP server** (`/mcp`) — the design system as seven typed tools: `search_tokens`, `get_token`, `check_contrast`, `list_docs`, `get_doc`, `lint_css`, `get_agents_guide`. Streamable HTTP, read-only, no auth. This is the highest-leverage way to consume the system: the tools return structured, verified data with no interpretation and no invention. See the MCP Server page.
- **Agent skill** (`/skill.md`) — a Claude Code skill that makes an agent build and review UI strictly by this system, never inventing a token, value, or rule. Copy it to `.claude/skills/ramoslabs-ds/SKILL.md` in a project, or `~/.claude/skills/…` globally.
- **llms.txt** (`/llms.txt`) — a concise index of every documentation page with its URL and summary.
- **llms-full.txt** (`/llms-full.txt`) — the entire system inlined into one self-contained document, plus the full token table. Fetch this when you want everything in context at once.
- **registry.json** (`/registry.json`) — structured tokens-by-category, the pattern list, and the components array, as JSON.
- **AGENTS.md** (`/AGENTS.md`) — the full agent onboarding guide: the hard contract and how to apply it.
- **tokens.json** (`/tokens.json`) — the flat DTCG token map (name to resolved value). Look up the exact token here before typing any value.

## Verify, do not scrape

The difference that matters: these tools are for correctness, not just discovery. `check_contrast` returns the WCAG ratio and the AA/AAA verdicts. `lint_css` flags a raw hex, rgb, px, or rem that should be a token and suggests the token. `get_token` returns the exact value and the `var(--…)` to use, and errors if the token does not exist so an agent can never invent one. An agent connected to the server builds against a contract it cannot get wrong, instead of interpreting a screenshot or a page of HTML.

## The one hard rule still applies

Everything an agent produces follows the same contract a human does: never hardcode a color, spacing, typography, radius, shadow, or motion value — read the token. Indigo 600 is the single action accent. WCAG 2.1 AA is the floor. The agent layer exists to make that contract easy to honor and impossible to fake.
