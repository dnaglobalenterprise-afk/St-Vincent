import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'

const CALLBACK_TIMEOUT_MS = 8000

function urlErrorDescription(): string | null {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const searchParams = new URLSearchParams(window.location.search)
  return (
    hashParams.get('error_description') ??
    searchParams.get('error_description') ??
    hashParams.get('error') ??
    searchParams.get('error')
  )
}

export function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const urlError = urlErrorDescription()
    if (urlError) {
      setError(urlError.replace(/\+/g, ' '))
      return
    }

    let done = false

    const finish = () => {
      if (done) return
      done = true
      navigate('/dashboard', { replace: true })
    }

    // The Supabase client processes the tokens in the callback URL and fires
    // SIGNED_IN; the session may also already be present by the time we mount.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
        finish()
      }
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish()
    })

    const timeout = setTimeout(() => {
      if (!done) {
        setError('We could not complete your sign-in. The link may have expired.')
      }
    }, CALLBACK_TIMEOUT_MS)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [navigate])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-surface-page px-4 py-24 text-center">
      {error ? (
        <>
          <p className="text-base text-danger">{error}</p>
          <Link to="/signin" className="font-medium text-svgblue-500 hover:text-svgblue-700">
            Back to sign in
          </Link>
        </>
      ) : (
        <>
          <Spinner size="lg" />
          <p className="text-base text-ink-muted">Signing you in…</p>
        </>
      )}
    </div>
  )
}
