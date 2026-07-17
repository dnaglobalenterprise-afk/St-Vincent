import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { initAnalytics, trackPageView } from '../lib/analytics'

/**
 * Loads Google Analytics 4 once, then reports a page view on every
 * client-side route change. Renders nothing. Must be placed inside
 * <BrowserRouter> so it can read the current location.
 */
export function Analytics() {
  const location = useLocation()

  useEffect(() => {
    initAnalytics()
  }, [])

  useEffect(() => {
    trackPageView(location.pathname + location.search)
  }, [location.pathname, location.search])

  return null
}
