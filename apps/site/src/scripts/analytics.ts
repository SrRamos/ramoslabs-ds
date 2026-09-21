// Client-only analytics + consent for the RamosLabs DS documentation site.
//
// Model: OPT-OUT. Google Analytics 4 + Microsoft Clarity load by default on every
// visit and KEEP loading unless the visitor explicitly rejects via the cookie
// banner. Rejecting disables both trackers and clears their cookies; re-accepting
// loads them again cleanly. This mirrors the house pattern used in simulamicredito,
// adapted to Astro/TypeScript.
//
// The measurement IDs are injected in <head> by BaseHead.astro as
// `window.RLDS_ANALYTICS_CONFIG` at page render time. This module loads NOTHING on
// import — it only acts when `applyConsent()` is called from the banner script.

export type ConsentState = 'unset' | 'accepted' | 'rejected'

const COOKIE_NAME = 'rlds_consent'
const MAX_AGE = 60 * 60 * 24 * 180 // ~180 days, in seconds

type AnalyticsConfig = { ga4Id?: string; clarityId?: string }

declare global {
  interface Window {
    RLDS_ANALYTICS_CONFIG?: AnalyticsConfig
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    clarity?: ((...args: unknown[]) => void) & { q?: unknown[] }
  }
}

let loaded = false

function config(): AnalyticsConfig {
  return (typeof window !== 'undefined' && window.RLDS_ANALYTICS_CONFIG) || {}
}

function win(): Record<string, unknown> {
  return window as unknown as Record<string, unknown>
}

/** Read the persisted consent decision (SSR-safe: 'unset' off the client). */
export function readConsent(): ConsentState {
  if (typeof document === 'undefined') return 'unset'
  const match = document.cookie.split('; ').find((c) => c.startsWith(COOKIE_NAME + '='))
  const value = match?.slice(COOKIE_NAME.length + 1)
  return value === 'accepted' || value === 'rejected' ? value : 'unset'
}

/** Persist the consent decision in a first-party cookie (~180 days). */
export function writeConsent(state: ConsentState): void {
  if (typeof document === 'undefined') return
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${COOKIE_NAME}=${state}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax${secure}`
}

function loadAnalytics(): void {
  if (loaded) return
  const { ga4Id = '', clarityId = '' } = config()

  // Skip placeholder / malformed IDs so a misconfigured build loads nothing.
  const isRealGa4 = /^G-[A-Z0-9]{6,}$/.test(ga4Id) && !/PLACEHOLDER/i.test(ga4Id)
  const isRealClarity = /^[a-z0-9]{8,}$/i.test(clarityId) && !/PLACEHOLDER/i.test(clarityId)
  if (!isRealGa4 && !isRealClarity) return

  loaded = true

  if (isRealGa4) {
    // Clear any prior opt-out flag so a re-accept actually tracks again.
    win()['ga-disable-' + ga4Id] = false

    const ga = document.createElement('script')
    ga.async = true
    ga.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ga4Id)
    document.head.appendChild(ga)

    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag() {
      window.dataLayer!.push(arguments)
    }
    window.gtag('js', new Date())
    // anonymize_ip keeps GA4 from storing the full visitor IP.
    window.gtag('config', ga4Id, { anonymize_ip: true })
  }

  if (isRealClarity) {
    ;(function (c: any, l: Document, a: string, r: string, i: string) {
      c[a] =
        c[a] ||
        function () {
          ;(c[a].q = c[a].q || []).push(arguments)
        }
      const t = l.createElement(r) as HTMLScriptElement
      t.async = true
      t.src = 'https://www.clarity.ms/tag/' + i
      const y = l.getElementsByTagName(r)[0]
      y.parentNode!.insertBefore(t, y)
    })(window, document, 'clarity', 'script', clarityId)

    // Privacy masking: mask all text so nothing visible or typed is captured in
    // Clarity recordings or heatmaps. We only want UX friction, never content.
    window.clarity?.('set', 'mask', true)
  }
}

// Delete a cookie across the host and its registrable-domain variants, so GA's
// dot-scoped cookies (".example.com") are actually removed, not just host-only ones.
function deleteCookie(name: string): void {
  const host = location.hostname
  const domains = ['', host, '.' + host]
  const parts = host.split('.')
  if (parts.length > 2) domains.push('.' + parts.slice(-2).join('.'))
  for (const d of domains) {
    document.cookie =
      name + '=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/' + (d ? '; Domain=' + d : '')
  }
}

// Opt-out: disable the trackers and clear the cookies they set.
function unloadAnalytics(): void {
  const { ga4Id = '' } = config()

  // GA4's official opt-out switch — blocks any further hits from this stream.
  if (ga4Id) win()['ga-disable-' + ga4Id] = true
  try {
    window.clarity?.('stop')
  } catch {
    // Clarity may not expose stop() depending on load state — best effort.
  }

  const names = new Set([
    '_ga',
    '_gid',
    '_gat',
    '_clck',
    '_clsk',
    'MUID',
    'MR',
    'SM',
    'CLID',
    'ANONCHK',
  ])
  document.cookie.split('; ').forEach((c) => {
    const n = c.split('=')[0]
    if (n.startsWith('_ga_') || n.startsWith('_gat_')) names.add(n)
  })
  names.forEach(deleteCookie)

  // Allow a future re-accept to load the trackers cleanly.
  loaded = false
}

/**
 * Opt-out entry point: load the trackers unless the visitor has explicitly
 * rejected. Safe to call repeatedly (guarded by `loaded`).
 */
export function applyConsent(): void {
  if (readConsent() === 'rejected') unloadAnalytics()
  else loadAnalytics()
}
