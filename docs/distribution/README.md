# Distribution kit (prepared, nothing published)

Everything here is ready to use but **nothing has been submitted anywhere**. Each external
publish needs explicit approval from the owner. Check a box only when it has actually happened.

## Checklist

### Official MCP Registry
- [ ] Review `server.json` (name `io.github.SrRamos/ramoslabs-ds`, version, description <= 100 chars).
- [ ] Confirm `https://design.ramoslabs.com/mcp` answers a `tools/list` call from outside the
      zone (Bot Fight Mode must allow it; otherwise point `remotes[].url` at the workers.dev mirror).
- [ ] `brew install mcp-publisher`, then from this folder: `mcp-publisher login github` and
      `mcp-publisher publish` (GitHub login must be the `SrRamos` account for the `io.github.SrRamos/` prefix).
- [ ] Verify: `curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.SrRamos/ramoslabs-ds"`.
- [ ] Bump `version` in `server.json` whenever the tool list changes, and republish.

### Directories
- [ ] Smithery: `smithery-listing.md`.
- [ ] PulseMCP: `pulsemcp-listing.md` (also picks up the official registry entry).
- [ ] Skill directories: `skill-directory-listing.md`.
- [ ] awesome-design-systems: `awesome-design-systems-pr.md` (open the PR only with approval).

### Packages and repo
- [ ] Merge this branch, then publish a new `@ramoslabs/tokens` version so the improved npm README
      (`packages/tokens/README.md`) is what npm shows. The README on npm only updates on publish.
- [ ] Set the GitHub repo "About": description, website `https://design.ramoslabs.com`, topics
      `design-system`, `design-tokens`, `mcp`, `llms-txt`, `wcag`, `css-variables`.
- [ ] Search engines: see `SEARCH-CONSOLES.md`.

## Facts every listing must keep identical

- Site: https://design.ramoslabs.com. Package: `@ramoslabs/tokens` (MIT, public npm).
- MCP: `/mcp`, Streamable HTTP, read-only, no auth, seven tools.
- Components are NOT shipped yet. Never claim a component library.
