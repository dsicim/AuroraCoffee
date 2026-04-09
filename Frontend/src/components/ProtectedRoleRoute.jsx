import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  authChangeEvent,
  currentUserChangeEvent,
  currentUserFetchStatus,
  fetchCurrentUserResult,
  getCurrentUserSnapshot,
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
  const [currentUserState, setCurrentUserState] = useState(() => getCurrentUserSnapshot())
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    const syncSession = () => {
      setSession(getAuthSession())
    }

    const syncCurrentUser = () => {
      setCurrentUserState(getCurrentUserSnapshot())
    }

    window.addEventListener('storage', syncSession)
    window.addEventListener(authChangeEvent, syncSession)
    window.addEventListener(currentUserChangeEvent, syncCurrentUser)

    return () => {
      window.removeEventListener('storage', syncSession)
      window.removeEventListener(authChangeEvent, syncSession)
      window.removeEventListener(currentUserChangeEvent, syncCurrentUser)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const handleGuardResult = (result) => {
      if (result.status === currentUserFetchStatus.unauthorized) {
        navigate(buildLoginPath(location.pathname, location.search), { replace: true })
        return
      }

      if (result.status === currentUserFetchStatus.error) {
        navigate('/', { replace: true })
        return
      }

      const resolvedRole = normalizeUserRole(result.user?.role)

      if (!resolvedRole) {
        navigate('/', { replace: true })
        return
      }

      if (requiredRole && resolvedRole !== requiredRole) {
        navigate(getRoleLandingPath(resolvedRole), { replace: true })
        return
      }

      setStatus('ready')
    }

    const guardRoute = async () => {
      if (!session?.token) {
        navigate(buildLoginPath(location.pathname, location.search), { replace: true })
        return
      }

      setStatus('checking')

      if (
        currentUserState.token !== session.token ||
        currentUserState.status === currentUserFetchStatus.idle
      ) {
        const result = await fetchCurrentUserResult(session.token)

        if (cancelled) {
          return
        }

        handleGuardResult(result)
        return
      }

      if (currentUserState.status === currentUserFetchStatus.loading) {
        return
      }

      handleGuardResult(currentUserState)
    }

    guardRoute()

    return () => {
      cancelled = true
    }
  }, [
    currentUserState,
    location.pathname,
    location.search,
    navigate,
    requiredRole,
    session?.token,
  ])

  if (status !== 'ready') {
    return null
  }

  return children
}
