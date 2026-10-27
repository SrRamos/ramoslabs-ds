// Content negotiation helpers for the Markdown twins of the doc pages.

/**
 * True when the client asks for Markdown ahead of HTML. Wildcards never select Markdown, so
 * browsers, curl (a wildcard Accept) and crawlers keep getting HTML. Equal q: the first listed wins.
 */
export function prefersMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  let md: { q: number; i: number } | null = null;
  let html: { q: number; i: number } | null = null;
  accept.split(',').forEach((part, i) => {
    const [type, ...params] = part.trim().toLowerCase().split(';');
    const qParam = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
    const q = qParam ? Number.parseFloat(qParam.slice(2)) : 1;
    if (!Number.isFinite(q) || q <= 0) return;
    if (type === 'text/markdown' && (!md || q > md.q)) md = { q, i };
    if (type === 'text/html' && (!html || q > html.q)) html = { q, i };
  });
  if (!md) return false;
  if (!html) return true;
  const m = md as { q: number; i: number };
  const h = html as { q: number; i: number };
  return m.q > h.q || (m.q === h.q && m.i < h.i);
}
