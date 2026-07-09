---
id: data-tables
title: Data Tables
group: patterns
storybookTitle: Patterns/Data Tables
summary: Native <table> first, the table vs role=grid fork, accessible sorting and row selection, density and alignment, pagination vs infinite scroll, filters, row actions, states, and the four mobile patterns
---

A data table is a native `<table>` first, always. Density, sorting, pagination, and the mobile transform are behavior layered on top of correct structure. Reach for an ARIA role only when native HTML genuinely cannot express the interaction.

# Part 1: Doctrine, the accessibility is not optional

## 1. Native <table> first, never div-soup

Build the table from real elements: a `<table>` with a `<caption>`, a `<thead>` and `<tbody>`, and `<th>` cells that carry `scope`. Without `<th>`, `scope`, and the table role, a screen reader cannot announce "column Amount, row Order 4521". The row and column relationship is simply lost.

**Rule:** Use a real `<table>` with `<caption>`, `<thead>` / `<tbody>`, and `<th scope="col">` for column headers plus `<th scope="row">` for each row's identifying cell.
**Why:** WCAG 2.1 SC 1.3.1 Info and Relationships (Level A) requires that structure conveyed visually be programmatically determinable. Scope is inferred in simple tables, but MDN and GOV.UK both advise setting it explicitly, because some assistive technology draws the wrong inference.

**Rule:** The `<caption>` is the table's accessible name. Give every table one.
**Why:** GOV.UK: a caption helps users find, navigate, and understand tables. It lets a screen reader user decide whether to read on or skip the table.

**Rule:** For multi-level or spanned headers, prefer splitting into smaller related tables over reaching for `headers` / `id` wiring.
**Why:** MDN recommends breaking a complex table apart rather than relying on `colspan` / `rowspan`. If you are reaching for `headers` / `id`, first ask whether this should be two tables.

## 2. The fork: <table> vs role="grid"

The most common mistake is over-reaching for `role="grid"`. The default is a static `<table>`. Most product tables, even with sorting, filtering, pagination, row links, and row actions, are not grids. The WAI-ARIA APG: like an HTML table, a WAI-ARIA table is a static tabular structure, not an interactive widget. You graduate to a grid only when the table is a spreadsheet the user operates cell by cell with arrow keys.

| Use a static `<table>` (default) when | Use `role="grid"` only when |
|---------------------------------------|-----------------------------|
| The table presents data to read, scan, and compare. | The table is an interactive widget operated like a spreadsheet. |
| Cells may hold links or buttons and the user tabs through them normally. | You need cell-by-cell arrow-key navigation with a single tab stop for the whole grid. |
| You have sorting, filtering, pagination. None of these require a grid. | You have editable cells or complex keyboard row and column selection. |

**A grid is a heavyweight commitment.** Once you adopt `role="grid"` you own focus management by roving tabindex (exactly one focusable element in the tab sequence at a time) and the full keyboard model: arrow keys move one cell and stop at edges, `Home` / `End` jump to row ends, `Ctrl+Home` / `Ctrl+End` to grid corners, and in an edit grid `Enter` or `F2` enters edit mode while `Escape` returns to navigation. Do not sign up for this to get sortable columns.

## 3. Sorting that a screen reader can follow

**Rule:** The sort control is a native `<button>` inside the `<th>`. Sort state lives in `aria-sort` on that `<th>`, on one column at a time.
**Why:** the APG sortable-table example wraps header text in a button, so keyboard support is free. Roselli: never set `aria-sort` on more than one header at once.

**Rule:** Signal direction by shape, a filled versus outline arrow marked `aria-hidden="true"`, not by color.
**Why:** encoding sort purely through color risks failing WCAG 1.4.1 Use of Color. The glyph is hidden from the accessible name so it does not pollute the button label.

**Rule:** Pair sorting with an optional polite live region that announces the change.
**Why:** Roselli tested support: NVDA, JAWS, Narrator, and VoiceOver on iOS announce `aria-sort`, but VoiceOver on macOS and TalkBack on Android do not. A live region is the only way those users hear that the order changed.

**Rule:** Communicate sortability itself through a `<caption>` hint, not a verbose per-button `aria-label`.
**Why:** the caption is announced once on table entry. Per-button labels translate poorly and are read on every cell. The visible button text must carry the meaning, because not every screen reader user is blind.

## 4. Row selection with a real indeterminate select-all

Each selectable row gets a native `<input type="checkbox">` whose accessible name identifies the row, not a generic "Select row". The header select-all checkbox uses the `indeterminate` DOM property (set in JavaScript, not the same as `checked`) when some but not all rows are selected: checked when all are, unchecked when none. All native checkboxes are tinted with `accent-color: var(--color-primary)`. Announce the derived selection count through a polite live region.

**Be explicit about scope across pages.** When the table is paginated, state whether a selection covers only the current page or the whole filtered set. Ambiguous selection is how users delete more than they meant to.

# Part 2: Anatomy, density, alignment and format

## 5. Density and alignment

Anchor row height to IBM Carbon's five-tier scale. Ship at least two densities: a comfortable default around 48px, touch and low-vision friendlier, and a compact opt-in around 32px for power users. Never ship compact only.

| Carbon tier | Height | Use when |
|-------------|--------|----------|
| Extra small / Compact | 24px | Dense exploration, expert users, maximum rows on screen |
| Small / Short | 32px | Dense with a little more breathing room |
| Medium | 40px | Balanced default for many products (added in Carbon 11) |
| Large / Default | 48px | Comfortable default, touch friendlier |
| Extra large / Tall | 64px | Rows with two lines, a value plus secondary text |

**Rule:** Left-align text, right-align numbers, and align each header with its own column.
**Why:** right-aligned digits line up by place value so columns of numbers become scannable. GOV.UK ships exactly this with numeric cell and header modifiers.

**Rule:** Put `font-variant-numeric: tabular-nums` on numeric columns.
**Why:** tabular figures occupy equal width, so a column of numbers aligns vertically digit by digit.

**Rule:** Interactive targets inside cells (sort buttons, row-action buttons, checkboxes, pagination links) meet at least 24 by 24 CSS px, or the 24px-spacing exception.
**Why:** WCAG 2.2 SC 2.5.8 Target Size (Minimum). A 24px compact row can hold a 24px target but leaves no spacing margin, so compact density plus icon buttons is a target-size risk. Prefer comfortable density anywhere row actions are tappable.

## 6. Zebra striping vs dividers

The evidence is softer than most assume. NN/g endorses borders, zebra striping, and hover highlighting as valid aids for keeping your place across a wide row, but publishes no controlled study crowning a winner. Anyone who tells you striping always beats dividers is inventing a result.

**Rule:** Pick one row-tracking aid, driven by table width, and do not stack them.
**Why:** for wide tables with many columns, zebra striping or a row hover highlight materially helps the eye stay on one record. For narrow tables, subtle horizontal dividers or nothing at all is cleaner. Stacking striping plus heavy borders plus hover is visual clutter.

**Rule:** Always add a row hover highlight and a matching focus highlight for keyboard users.
**Why:** hover helps mouse users track a row, but keyboard users need the same anchor on focus, never one without the other.

## 7. Data formatting

| Type | Format rule |
|------|-------------|
| Numbers | Right-align, `tabular-nums`, group thousands. Keep a shared unit in the header, `Price (COP)`, not in every cell. |
| Currency | Right-align, one consistent symbol and decimal count per column. For this product's COP context, whole pesos. |
| Dates | One format per column. Wrap the machine value in `<time datetime="...">`. Show relative dates only when a precise value is available on hover or focus. |
| Text | Left-align. Decide truncate or wrap per column, not per table. |
| Empty cells | Use an explicit placeholder shown as a dash, with an accessible meaning, never a blank cell that reads as nothing. |

**Rule:** Wrap content the user must read in full (names, addresses, descriptions), pairing it with the tall 64px density.
**Why:** truncating a value the user needs to read makes the table useless for that task.

**Rule:** Truncate with an ellipsis only for low-value tails (IDs, URLs, long machine strings), and always give an accessible way to recover the full value with `title` or a tooltip.
**Why:** truncation buys column alignment, but hiding a value with no way to read it fails the user who needs it.

# Part 3: Behavior, pagination, filters, actions, states

## 8. Pagination vs infinite scroll vs load-more

Data tables are goal-oriented lookup and compare surfaces, so the default is pagination. NN/g finds infinite scroll suits homogeneous feeds with no particular task, and recommends avoiding it when users need to find something specific, compare items in a long list, or return to an item they saw.

| Pattern | Use for a table when |
|---------|----------------------|
| Pagination (default) | Users look up, compare, and return to items, and need a sense of position, a total, and access to a footer or summary. |
| Load-more button | Mostly-browse lists where you still want footer access and user-controlled loading. A middle ground. |
| Infinite scroll | Rare for tables. Only a pure exploratory feed with no find, compare, or return task. |

**Rule:** Always show the current range and the total, "1-25 of 320", and let users choose the page size.
**Why:** it gives position and scope, directly answering the "where am I" problem infinite scroll creates.

**Rule:** Wrap controls in `<nav aria-label="Table pagination">`, mark the current page with `aria-current="page"`, meet SC 2.5.8 target size, and announce the new range politely.
**Why:** WCAG cites pagination links as a case for the 24px target-size rule. Swapping the table body is not auto-announced, so a live region carries the change.

## 9. Filters and search

Give the table a global search that filters across columns, and per-column filters where users repeatedly narrow by known dimensions. Keep the sort button and any column filter as separate, separately-labeled controls, never overloaded onto one target. Make the current filter state visible.

**Rule:** Every applied filter renders as a visible, removable chip with an accessible name, plus a "Clear all".
**Why:** chips are the honest answer to "what am I currently looking at". A filtered table that hides its own active filters is a dark pattern of confusion.

**Rule:** State the filtered count against the total on the table itself, "Showing 12 of 320, filters active", and announce result counts through a polite live region.
**Why:** users must never mistake a filtered view for the whole dataset. When filtering reaches zero rows, show the no-results state, not the empty state.

## 10. Row actions and bulk actions

Show one or two primary, high-frequency actions as inline buttons in an actions column. Collapse three or more, or any secondary actions, into an overflow kebab menu. Icon-only buttons must carry an `aria-label`. For bulk work, select rows through the checkboxes, then reveal a contextual toolbar when at least one row is selected.

**The hover-only trap.** Row actions must never appear on mouse hover alone. Hover does not exist on touch and is unreachable by keyboard. Actions must be always rendered (optionally lower contrast until hover or focus), never hidden with `display:none` behind a hover, and every target meets the 24 by 24px minimum.

- ✓ Recommended: actions always visible and focusable.
- ✕ Avoid: actions that only appear on hover (hidden until hover, unreachable on touch).

## 11. States: empty, loading, error, no results

A table has four states beyond happy-path data, and two are constantly confused.

- Empty (no data yet): explains why the table is empty and offers a primary action to add the first record.
- No results (after filtering to zero rows): says the filters matched nothing and offers a one-click Clear filters. Different from empty.
- Loading: prefers skeleton rows that mirror the real column layout over a bare spinner, with the region marked `aria-busy="true"` while it loads.
- Error: keep any stale data visible under an error banner with a retry (in a `role="alert"`) rather than blanking the screen.

# Part 4: Mobile and advanced

## 12. Mobile, the hard problem

Tables do not fit narrow viewports, and WCAG SC 1.4.10 Reflow gives them a specific carve-out. Content must reflow to 320 CSS px without two-dimensional scrolling, except for parts that require a two-dimensional layout for meaning, and the standard names "data tables (not individual cells)" as exactly such a part. A data table is permitted to scroll horizontally on a phone and you do not fail Reflow for it, as long as the surrounding page still reflows. Horizontal scroll is a legitimate, standards-blessed strategy, not a hack.

- **A. Scroll region + sticky first column (Default).** Keep the real `<table>`. Wrap it in a focusable, labeled scroll region and freeze the identifying first column. Gain: bulletproof semantics, about six lines of CSS, no JS, no data duplication. Lose: the user scrolls to reach far columns, so mitigate with the sticky first column.
- **B. Stacked cards (Repair needed).** Collapse each row into a key and value card with `td::before` labels. Gain: no horizontal scroll, great for single records. Lose: `display:block` destroys table semantics, so you MUST restore roles with ARIA, and cross-record comparison becomes nearly impossible.
- **C. Priority columns + expand (Alternative).** Show only the top-priority columns on narrow screens, reveal the rest behind a columns toggle or an expandable row. Gain: keeps a real table and fits the width. Lose: hidden data is out of sight, so the toggle state must be announced and persistent.
- **D. Not a table at all (Alternative).** Show a scannable list of summary items linking to a full detail view. Put the real table on wider viewports. Gain: simplest reading on a phone. Lose: cross-column comparison is not available on mobile, so use it only when identity dominates.

**The conflict, resolved in favor of Roselli.** CSS-Tricks (Coyier, 2011) claims the `display:block` card transform stays accessible. Roselli's assistive-technology testing (2017, updated 2024) shows the opposite: as soon as the table becomes `display:block`, screen readers stop treating it as a table. We trust Roselli, the AT-tested specialist. If you use the card pattern you must repair semantics with ARIA roles. Otherwise, prefer Pattern A.

Mobile decision ladder:
1. Is cross-column comparison the core task? Use Pattern A, scroll region with a sticky first column.
2. Do users inspect one record at a time? Use Pattern C (priority + expand) or Pattern B (cards, with ARIA repair).
3. Is it really a list of records, not a comparison grid? Use Pattern D, list plus detail.
4. Never: hover-only actions. Never: assume `display:block` keeps semantics.

**Why the region needs `tabindex="0"`.** Roselli's pattern wraps the table in `<div role="region" aria-labelledby="..." tabindex="0">`. The tabindex satisfies WCAG SC 2.1.1 Keyboard so a keyboard user can tab to the region and scroll it. Avoid CSS scroll-snap here: it clips cells, and users need to compare adjacent cells freely.

## 13. Advanced: editing, expansion, pinning, virtualization

| Feature | Rule and cost |
|---------|---------------|
| Editable cells / data grid | This is where you graduate to `role="grid"` with the edit-grid keyboard model (`Enter` or `F2` to edit, `Escape` to exit). Do not bolt inline edit onto a static table without the grid contract. |
| Column resize / reorder | Provide keyboard-operable handles, announce the new size or position, and persist per user. High effort, ship only if users demonstrably need it. |
| Expandable rows | A disclosure `<button>` per row with `aria-expanded` toggling an adjacent detail region. A natural home for secondary columns on mobile Pattern C. Test density against expanded content together. |
| Column pinning | Use CSS `position: sticky`, and pin only the identifier column. Freezing many columns eats mobile width. |
| Virtualization | Render only visible rows for very large datasets. It breaks find-in-page and can confuse assistive technology. If you virtualize, set `aria-rowcount` and `aria-rowindex` so AT knows the true totals. Treat it as a last resort after pagination. |

## Sources

MDN Web Docs, the `<table>` element and its accessibility: semantic markup, correct child order (`caption`, `colgroup`, `thead`, `tbody`, `tfoot`), explicit `scope`, split-over-`headers`/`id` guidance, wrapping dates in `<time>`. WAI-ARIA APG, Table and Grid patterns: native table strongly encouraged, a WAI-ARIA table is static not interactive, a grid is a composite widget with a single tab stop and roving tabindex; the Sortable Table example. Adrian Roselli: Sortable Table Columns (one `aria-sort` at a time, VoiceOver macOS and TalkBack do not announce it, signal by shape, prefer a caption hint), Under-Engineered Responsive Tables (the `role="region"` plus `tabindex="0"` scroll pattern, no scroll-snap), A Responsive Accessible Table (`display:block` stops screen readers treating it as a table). GOV.UK Design System, Table component. Nielsen Norman Group: Data Tables (borders, zebra striping, hover all help place-keeping), Infinite Scrolling (avoid for find/compare/return, so tables default to pagination). W3C Understanding WCAG: SC 1.3.1 (A), 1.4.1 (A), 2.1.1 (A), 1.4.10 Reflow (AA) with its data-table carve-out, 2.5.8 (24px, AA). IBM Carbon Design System row-height tiers (Compact 24, Short 32, Medium 40, Default 48, Tall 64). CSS-Tricks, Responsive Data Tables (Coyier, 2011), resolved in favor of Roselli. House rules layered on the cited guidance: the width-driven zebra-versus-dividers heuristic, `tabular-nums` on numeric columns, the checkbox plus indeterminate select-all, and the filter, states, and virtualization accessibility hooks.
