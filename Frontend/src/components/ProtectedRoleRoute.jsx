import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  authChangeEvent,
  currentUserFetchStatus,
  fetchCurrentUserResult,
  getAuthSession,
} from '../lib/auth'
import { getRoleLandingPath, normalizeUserRole } from '../lib/roles'

function buildLoginPath(pathname, search) {
  return `/login?next=${encodeURIComponent(pathname + search)}`
}

export default function ProtectedRoleRoute({ requiredRole, children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [session, setSession] = useState(() => getAuthSession())
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    const syncSession = () => {
      setSession(getAuthSession())
    }

    window.addEventListener('storage', syncSession)
    window.addEventListener(authChangeEvent, syncSession)

    return () => {
      window.removeEventListener('storage', syncSession)
      window.removeEventListener(authChangeEvent, syncSession)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const guardRoute = async () => {
      if (!session?.token) {
        navigate(buildLoginPath(location.pathname, location.search), { replace: true })
        return
      }

      setStatus('checking')
      const result = await fetchCurrentUserResult(session.token)

      if (cancelled) {
        return
      }

      if (result.status === currentUserFetchStatus.unauthorized) {
        navigate(buildLoginPath(location.pathname, location.search), { replace: true })
        return
      }

      if (result.status === currentUserFetchStatus.error) {
        navigate('/', { replace: true })
        return
      }

      const resolvedRole = normalizeUserRole(result.user.role)

      if (requiredRole && resolvedRole !== requiredRole) {
        navigate(getRoleLandingPath(resolvedRole), { replace: true })
        return
      }

      setStatus('ready')
    }

    guardRoute()

    return () => {
      cancelled = true
    }
  }, [location.pathname, location.search, navigate, requiredRole, session?.token])

  if (status !== 'ready') {
    return null
  }

  return children
}
