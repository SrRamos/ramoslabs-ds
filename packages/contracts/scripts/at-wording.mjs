// Permitted assistive-technology status wording (W1-318, ADR-015 "Honesty", ADR-010 AT honesty gate).
// One source for codegen, registry.json, the MCP tools and the generated docs, so no surface can
// invent a stronger claim than the contract's `test_status`.

export const EVIDENCE_ONLY_WORDING = 'implemented to documented evidence, not hands-on tested';
export const PENDING_WORDING =
  'implemented to documented evidence, hands-on test pending and not yet logged';

/**
 * The only wording a surface may print for an atSupport row.
 * `tested-real` rows are rendered from their own date and log, never from a default.
 * @param {{ test_status: string, tested_on?: string, log?: string }} row
 * @returns {string}
 */
export function atWording(row) {
  if (row.test_status === 'evidence-only') return EVIDENCE_ONLY_WORDING;
  if (row.test_status === 'pending-real-test') return PENDING_WORDING;
  if (row.test_status === 'tested-real' && row.tested_on && row.log)
    return `hands-on real-tested on ${row.tested_on}, log ${row.log}`;
  throw new Error(`atWording: unusable atSupport row (test_status=${row.test_status})`);
}

/** Markdown lines (one bullet per row) for docs generators. */
export function atSupportMarkdown(rows) {
  return rows
    .map((r) => `- ${r.at} / ${r.platform} / ${r.browser}: ${r.test_status}; ${atWording(r)}`)
    .join('\n');
}
