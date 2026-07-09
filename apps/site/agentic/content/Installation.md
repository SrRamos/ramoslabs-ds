---
id: installation
title: Installation
group: root
summary: Install @ramoslabs/tokens from npm, import the CSS variables once at your app entry, and build against the token contract — plus the no-install path and the framework notes
---

Install `@ramoslabs/tokens` from npm, import the CSS variables once at your app entry, and reference the tokens everywhere. The tokens are the single source of truth; nothing hardcodes a value.

## 1. Install the tokens

The package is published on the public npm scope. Use any package manager: `bun add @ramoslabs/tokens`, `npm install @ramoslabs/tokens`, `pnpm add @ramoslabs/tokens`, or `yarn add @ramoslabs/tokens`.

## 2. Import the CSS once

At your app entry, import the generated CSS variables a single time: `@import '@ramoslabs/tokens/css';`. Every `--color-*`, `--space-*`, `--radius-*`, `--shadow-*`, `--font-*`, and motion variable is then available globally.

## 3. Build against the contract

Reference the tokens in your styles — never a raw value. For example a card reads `background: var(--color-surface); padding: var(--space-6); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);`. A raw hex or px in your CSS is a defect. Typed values are available from the package root for TypeScript, and the flat name-to-value map is `@ramoslabs/tokens/json`.

## Without installing

You do not have to install the package to consume the system. Read the served flat token map at `/tokens.json`, or `@import` the served stylesheet from the documentation site. This is useful for a quick prototype or a build that cannot add the dependency.

## Framework notes

The tokens are framework-agnostic CSS variables and typed values — they work in any stack (plain CSS, Vue, React, Svelte, Astro, Tailwind via CSS variables). Import the CSS once at the root; in a component framework that means the app entry or root layout, not each component.

## For AI agents

An agent should not fetch or scrape these values by hand. Connect the MCP server and use `get_token` and `check_contrast` instead — see the For Agents and MCP Server pages. Components (`SJ`/`W`) are not shipped yet; until they land, build from these tokens and the documented patterns.
