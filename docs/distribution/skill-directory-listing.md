# Agent skill listing (prepared, not submitted)

The skill is versioned at `.claude/skills/ramoslabs-ds/SKILL.md` and served at
https://design.ramoslabs.com/skill.md.

- **Name:** ramoslabs-ds
- **One line:** Build or review UI strictly from the RamosLabs Design System's own sources,
  never inventing tokens, values, rules, or components.
- **Prime directive:** use only what the DS defines; if something is missing, fetch the source,
  reuse an existing token or pattern, or stop and ask.
- **Triggers:** "RamosLabs DS", `@ramoslabs/tokens`, design tokens, brand color, building or
  reviewing a component or screen for a RamosLabs project.
- **Install:** copy `skill.md` to `.claude/skills/ramoslabs-ds/SKILL.md` in a project, or to
  `~/.claude/skills/ramoslabs-ds/SKILL.md` globally.
  `mkdir -p .claude/skills/ramoslabs-ds && curl -sL https://design.ramoslabs.com/skill.md -o .claude/skills/ramoslabs-ds/SKILL.md`
- **Pairs with:** the MCP server (`/agents/mcp/`) for verified token and contrast lookups.
- **Repository:** https://github.com/SrRamos/ramoslabs-ds (MIT)

Directories that accept skills use their own submission flow (usually a PR or a form against a
repository index). Pick the target, then copy the fields above. None has been contacted.
