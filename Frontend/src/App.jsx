import { Suspense, useEffect, useRef } from 'react'
import { BrowserRouter, useLocation } from 'react-router-dom'
import AppRoutes from './app/router'
import { logFrontendDebug } from './lib/frontendDebug'

function RouteFallback() {
  useEffect(() => {
    logFrontendDebug('route:fallback-mounted')

    return () => {
      logFrontendDebug('route:fallback-unmounted')
    }
  }, [])

  return (
    <div className="aurora-route-fallback" role="status" aria-live="polite">
      Loading Aurora Coffee
    </div>
  )
}

function RouteDebugLogger() {
  const location = useLocation()
  const previousLocationRef = useRef(null)

  useEffect(() => {
    const previousLocation = previousLocationRef.current

    logFrontendDebug('route:location-change', {
      from: previousLocation
        ? `${previousLocation.pathname}${previousLocation.search}${previousLocation.hash}`
        : '',
      to: `${location.pathname}${location.search}${location.hash}`,
      key: location.key,
    })

    previousLocationRef.current = location
  }, [location])

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <RouteDebugLogger />
      <Suspense fallback={<RouteFallback />}>
        <AppRoutes />
      </Suspense>
    </BrowserRouter>
  )
}
