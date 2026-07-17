// Google Analytics 4 via the official gtag.js library.
// This app is a Vite + React Router SPA (not Next.js), so we load gtag.js
// directly and report page views manually on route changes — a single-page
// app only triggers gtag's automatic page_view once, on the initial load.
// Docs: https://developers.google.com/analytics/devguides/collection/ga4

// Configurable per environment; falls back to the project's Measurement ID so
// production works even if the env var isn't set on the host. GA IDs are public.
const MEASUREMENT_ID =
  (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined) ?? 'G-28TDNZ6W23'

// Only report from real production builds in the browser — never pollute
// analytics with local dev traffic.
const ENABLED =
  import.meta.env.PROD && typeof window !== 'undefined' && Boolean(MEASUREMENT_ID)

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
  }
}

let initialized = false

/** Inject gtag.js once and configure GA4. Safe to call repeatedly. */
export function initAnalytics(): void {
  if (!ENABLED || initialized) return
  initialized = true

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args)
  }

  window.gtag('js', new Date())
  // send_page_view:false — page views are sent manually (see trackPageView)
  // so client-side navigations are counted and the first view isn't doubled.
  window.gtag('config', MEASUREMENT_ID, { send_page_view: false })
}

/** Report a page view. Call on every route change, including the first. */
export function trackPageView(path: string): void {
  if (!ENABLED || !initialized) return
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  })
}
