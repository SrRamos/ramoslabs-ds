export const EVIDENCE_ONLY_WORDING: string;
export const PENDING_WORDING: string;
type Row = { test_status: string; tested_on?: string; log?: string };
export function atWording(row: Row): string;
export function atSupportMarkdown(
  rows: (Row & { at: string; platform: string; browser: string })[],
): string;
