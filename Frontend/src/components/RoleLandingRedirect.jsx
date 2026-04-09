import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  authChangeEvent,
  currentUserChangeEvent,
  currentUserFetchStatus,
  fetchCurrentUserResult,
  getCurrentUserSnapshot,
  getAuthSession,
} from '../lib/auth'
import { getRoleLandingPath, normalizeUserRole, openRolePopup, userRoles } from '../lib/roles'

export default function RoleLandingRedirect() {
  const navigate = useNavigate()
  const [session, setSession] = useState(() => getAuthSession())
  const [currentUserState, setCurrentUserState] = useState(() => getCurrentUserSnapshot())

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

    const redirectToRoleHome = async () => {
      if (!session?.token) {
        navigate('/', { replace: true })
        return
      }

      if (
        currentUserState.token !== session.token ||
        currentUserState.status === currentUserFetchStatus.idle
      ) {
        const result = await fetchCurrentUserResult(session.token)

        if (cancelled) {
          return
        }

        if (result.status === currentUserFetchStatus.ok) {
          if (normalizeUserRole(result.user?.role) === userRoles.admin) {
            openRolePopup(result.user?.role)
            return
          }
          navigate(getRoleLandingPath(result.user.role), { replace: true })
          return
        }

        navigate('/', { replace: true })
        return
      }

      if (currentUserState.status === currentUserFetchStatus.loading) {
        return
      }

      if (currentUserState.status === currentUserFetchStatus.ok) {
        if (normalizeUserRole(currentUserState.user?.role) === userRoles.admin) {
          openRolePopup(currentUserState.user?.role)
          return
        }
        navigate(getRoleLandingPath(currentUserState.user?.role), { replace: true })
        return
      }

      navigate('/', { replace: true })
    }

    redirectToRoleHome()

    return () => {
      cancelled = true
    }
  }, [currentUserState, navigate, session?.token])

  return null
}
