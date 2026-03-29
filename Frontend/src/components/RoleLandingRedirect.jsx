import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  authChangeEvent,
  currentUserFetchStatus,
  fetchCurrentUserResult,
  getAuthSession,
} from '../lib/auth'
import { getRoleLandingPath } from '../lib/roles'

export default function RoleLandingRedirect() {
  const navigate = useNavigate()
  const [session, setSession] = useState(() => getAuthSession())

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

    const redirectToRoleHome = async () => {
      if (!session?.token) {
        navigate('/', { replace: true })
        return
      }

      const result = await fetchCurrentUserResult(session.token)

      if (cancelled) {
        return
      }

      if (result.status === currentUserFetchStatus.ok) {
        navigate(getRoleLandingPath(result.user.role), { replace: true })
        return
      }

      navigate('/', { replace: true })
    }

    redirectToRoleHome()

    return () => {
      cancelled = true
    }
  }, [navigate, session?.token])

  return null
}
