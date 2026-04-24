import { Suspense } from 'react'
import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './app/router'

function RouteFallback() {
  return (
    <div className="aurora-route-fallback" role="status" aria-live="polite">
      Loading Aurora Coffee
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <AppRoutes />
      </Suspense>
    </BrowserRouter>
  )
}
