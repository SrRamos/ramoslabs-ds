# Smithery listing (prepared, not submitted)

Paste-ready content for the Smithery remote-server form. Re-check the current form fields at
https://smithery.ai before submitting; the field names below are the content, not a promise
about their UI.

- **Name:** RamosLabs Design System
- **Qualified name suggestion:** `ramoslabs-ds`
- **Server URL (Streamable HTTP, no auth):** `https://design.ramoslabs.com/mcp`
  (mirror without zone bot protection: `https://ramoslabs-ds.edwardramosp.workers.dev/mcp`)
- **Homepage:** https://design.ramoslabs.com/agents/mcp/
- **Repository:** https://github.com/SrRamos/ramoslabs-ds
- **License:** MIT
- **Short description:** Read-only design tokens, WCAG contrast checks, and CSS linting for the
  RamosLabs Design System, so agents use real token values instead of inventing them.
- **Long description:** The RamosLabs DS is a mono-indigo, token-first design system. This MCP
  server exposes it as seven typed, read-only tools. Agents look up exact token values, verify
  WCAG contrast pairs, read the distilled doctrine for a foundation or pattern, and lint CSS for
  raw hex, rgb, px, or rem values that should be tokens. Stateless, no auth, no side effects.
- **Tools:** `search_tokens`, `get_token`, `check_contrast`, `list_docs`, `get_doc`, `lint_css`,
  `get_agents_guide`
- **Suggested tags:** design-system, design-tokens, accessibility, wcag, css, frontend

Source of truth for tools: `docs/MCP.md`.
