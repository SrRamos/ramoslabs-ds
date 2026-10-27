# PulseMCP listing (prepared, not submitted)

PulseMCP lists servers from the official MCP Registry and also accepts submissions. Publishing
`server.json` to the official registry (see `README.md` in this folder) is the primary route.
If you submit directly, use this content. Re-check https://www.pulsemcp.com before submitting.

- **Name:** RamosLabs Design System
- **URL:** `https://design.ramoslabs.com/mcp` (Streamable HTTP, read-only, no auth)
- **Source:** https://github.com/SrRamos/ramoslabs-ds
- **Docs:** https://design.ramoslabs.com/agents/mcp/
- **Description:** Typed, read-only tools that return exact design tokens, WCAG contrast
  verdicts, distilled design doctrine, and CSS lint results for the RamosLabs Design System.
- **Tools (7):** `search_tokens`, `get_token`, `check_contrast`, `list_docs`, `get_doc`,
  `lint_css`, `get_agents_guide`
- **Connect (Claude Code):**
  `claude mcp add --transport http ramoslabs-ds https://ramoslabs-ds.edwardramosp.workers.dev/mcp`
