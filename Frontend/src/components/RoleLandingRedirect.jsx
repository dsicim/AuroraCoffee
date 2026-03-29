import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authChangeEvent, fetchCurrentUser, getAuthSession } from '../lib/auth'
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

      const user = await fetchCurrentUser(session.token)

      if (cancelled) {
        return
      }

      navigate(getRoleLandingPath(user?.role), { replace: true })
    }

    redirectToRoleHome()

    return () => {
      cancelled = true
    }
  }, [navigate, session?.token])

  return null
}
