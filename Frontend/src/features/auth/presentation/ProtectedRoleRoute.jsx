import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  authChangeEvent,
  currentUserChangeEvent,
  currentUserFetchStatus,
  fetchCurrentUserResult,
  getAuthStateSnapshot,
} from '../application/auth'
import { canAccessRole, getRoleLandingPath, normalizeUserRole } from '../domain/roles'

function buildLoginPath(pathname, search) {
  return `/login?next=${encodeURIComponent(pathname + search)}`
}

export default function ProtectedRoleRoute({ requiredRole, children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [authState, setAuthState] = useState(() => getAuthStateSnapshot())
  const [status, setStatus] = useState('checking')
  const lastGuardValidationKeyRef = useRef(null)
  const session = authState.session
  const currentUserState = authState.currentUserState

  useEffect(() => {
    const syncAuthState = () => {
      const nextAuthState = getAuthStateSnapshot()
      setAuthState(nextAuthState)

      if (nextAuthState.shouldRequestLogin) {
        setStatus('checking')
      }
    }

    window.addEventListener('storage', syncAuthState)
    window.addEventListener(authChangeEvent, syncAuthState)
    window.addEventListener(currentUserChangeEvent, syncAuthState)

    return () => {
      window.removeEventListener('storage', syncAuthState)
      window.removeEventListener(authChangeEvent, syncAuthState)
      window.removeEventListener(currentUserChangeEvent, syncAuthState)
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

      if (requiredRole && !canAccessRole(resolvedRole, requiredRole)) {
        navigate(getRoleLandingPath(resolvedRole), { replace: true })
        return
      }

      setStatus('ready')
    }

    const guardRoute = async () => {
      if (authState.shouldRequestLogin || !session?.token) {
        setStatus('checking')
        navigate(buildLoginPath(location.pathname, location.search), { replace: true })
        return
      }

      setStatus('checking')
      const guardValidationKey = [
        session.token,
        location.pathname,
        location.search,
        requiredRole || '',
      ].join('|')
      const shouldValidateRouteEntry =
        lastGuardValidationKeyRef.current !== guardValidationKey

      if (
        shouldValidateRouteEntry ||
        currentUserState.token !== session.token ||
        currentUserState.status === currentUserFetchStatus.idle
      ) {
        lastGuardValidationKeyRef.current = guardValidationKey
        const result = await fetchCurrentUserResult(session.token, {
          force: shouldValidateRouteEntry,
        })

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
    authState.shouldRequestLogin,
    location.pathname,
    location.search,
    navigate,
    requiredRole,
    session?.token,
  ])

  if (authState.shouldRequestLogin || status !== 'ready') {
    return null
  }

  return children
}
