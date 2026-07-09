---
id: mcp
title: MCP Server
group: agents
summary: The Model Context Protocol server — seven typed, read-only tools, how to connect each client, and why the tools verify rather than just install
---

The design system ships a Model Context Protocol (MCP) server so any MCP-capable agent (Claude Code, Cursor, Windsurf, and others) gets the system as typed, verifiable tools instead of scraping HTML or fetching files. It is stateless, read-only, and needs no auth. Transport is Streamable HTTP; the endpoint is `POST /mcp`.

## The seven tools

- `search_tokens(query, limit?)` — find tokens by name or value substring.
- `get_token(name)` — the exact token value plus the `var(--…)` to use. Errors if it does not exist, so an agent never invents one.
- `check_contrast(foreground, background)` — the WCAG ratio plus AA/AAA verdicts for normal text, large text, and UI.
- `list_docs()` — every documentation page title (foundations and patterns).
- `get_doc(title)` — the full distilled doctrine for one page. Read it before implementing a pattern.
- `lint_css(code)` — flag a raw hex, rgb, px, or rem that should be a token, and suggest the matching token.
- `get_agents_guide()` — the full AGENTS.md agent guide.

## Not install — verify

Most component MCP servers exist to discover and install code. This one exists so an agent gets the system right: contrast checked, CSS linted against the token contract, and token values returned exact and never invented. The tools are structured and verified, so the agent builds against a contract instead of interpreting rendered output.

## Connect it

Claude Code: `claude mcp add --transport http ramoslabs-ds https://design.ramoslabs.com/mcp`.

Other MCP clients (Cursor, Windsurf, …): add a server entry with the URL `https://design.ramoslabs.com/mcp` and transport `http`. The agent then has `search_tokens`, `check_contrast`, `lint_css`, and the rest as first-class tools — no WebFetch, no HTML interpretation, no invented values.

## Quick check

Call `tools/list` against the endpoint to confirm the seven tools, then call `check_contrast` with the primary accent on white to confirm it verifies (indigo 600 on white returns roughly 6.3:1, which passes AA).
