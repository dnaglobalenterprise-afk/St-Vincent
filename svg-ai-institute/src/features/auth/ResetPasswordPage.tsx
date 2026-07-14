import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DiamondMotif } from '../../components/ui/DiamondMotif'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'

/** Landing page for the password-reset email link. The client processes the
 *  recovery token in the URL and establishes a session; the user then sets a
 *  new password. Also usable by a signed-in user to change their password. */
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // The recovery link fires PASSWORD_RECOVERY once the token is processed;
    // a session may also already be present (e.g. changing password while signed in).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) { setHasSession(true); setReady(true) }
    })
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session)
      setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setBusy(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (err) return setError(err.message)
    setDone(true)
    setTimeout(() => navigate('/dashboard', { replace: true }), 1500)
  }

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-svgblue-50 px-4 py-16">
      <DiamondMotif size={320} className="-top-6 left-1/2 -translate-x-1/2" />
      <Card className="relative w-full max-w-md">
        {!ready ? (
          <div className="flex justify-center py-8"><Spinner size="lg" /></div>
        ) : done ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-svggreen-100"><CheckCircle2 className="h-7 w-7 text-svggreen-500" /></span>
            <h1 className="font-heading text-2xl font-semibold text-ink">Password set</h1>
            <p className="text-base text-ink-muted">Signing you in…</p>
          </div>
        ) : !hasSession ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <h1 className="font-heading text-2xl font-semibold text-ink">Link expired</h1>
            <p className="text-base text-ink-muted">This reset link is invalid or has expired. Request a new one from the sign-in page.</p>
            <Button onClick={() => navigate('/signin')}>Back to sign in</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-5 py-2">
            <div className="flex flex-col gap-2">
              <h1 className="font-heading text-2xl font-semibold text-ink">Set a new password</h1>
              <p className="text-base text-ink-muted">Choose a password you&apos;ll remember — at least 8 characters.</p>
            </div>
            <Input type="password" name="password" label="New password" placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <Input type="password" name="confirm" label="Confirm password" placeholder="••••••••" required value={confirm} onChange={(e) => setConfirm(e.target.value)} error={error ?? undefined} />
            <Button type="submit" loading={busy} className="w-full">Save password</Button>
          </form>
        )}
      </Card>
    </div>
  )
}
