import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DiamondMotif } from '../../components/ui/DiamondMotif'
import { Input } from '../../components/ui/Input'

const RESEND_COOLDOWN_SECONDS = 30

type Mode = 'password' | 'magic' | 'forgot' | 'sent-link' | 'sent-reset'

export function SignInPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((s) => s - 1), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const reset = (m: Mode) => { setMode(m); setError(null) }

  const signInPassword = async () => {
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (err) {
      setError(err.message === 'Invalid login credentials' ? 'Wrong email or password.' : err.message)
      return
    }
    navigate('/dashboard', { replace: true })
  }

  const sendLink = async () => {
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/auth/callback' },
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    setMode('sent-link')
    setCooldown(RESEND_COOLDOWN_SECONDS)
  }

  const sendReset = async () => {
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/auth/reset',
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    setMode('sent-reset')
    setCooldown(RESEND_COOLDOWN_SECONDS)
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (mode === 'password') void signInPassword()
    else if (mode === 'magic') void sendLink()
    else if (mode === 'forgot') void sendReset()
  }

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-svgblue-50 px-4 py-16">
      <DiamondMotif size={320} className="-top-6 left-1/2 -translate-x-1/2" />
      <DiamondMotif size={200} opacity={0.08} className="bottom-4 -left-16" />
      <DiamondMotif size={200} opacity={0.08} className="-right-16 bottom-20" />

      <Card className="relative w-full max-w-md">
        {mode === 'sent-link' || mode === 'sent-reset' ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-svggreen-100">
              <MailCheck className="h-7 w-7 text-svggreen-500" aria-hidden="true" />
            </span>
            <h1 className="font-heading text-2xl font-semibold text-ink">Check your email</h1>
            <p className="text-base text-ink-muted">
              {mode === 'sent-link'
                ? <>We sent a sign-in link to <span className="font-medium text-ink">{email}</span>. Click it to sign in.</>
                : <>We sent a password-reset link to <span className="font-medium text-ink">{email}</span>. Click it to set a new password.</>}
            </p>
            <Button variant="ghost" size="sm" disabled={cooldown > 0} loading={busy}
              onClick={() => void (mode === 'sent-link' ? sendLink() : sendReset())}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
            </Button>
            <button type="button" onClick={() => reset('password')} className="text-sm font-medium text-svgblue-500 hover:text-svgblue-700">
              Back to sign in
            </button>
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-5 py-2">
            <div className="flex flex-col gap-2">
              <h1 className="font-heading text-2xl font-semibold text-ink">
                {mode === 'forgot' ? 'Reset your password' : 'Sign in'}
              </h1>
              <p className="text-base text-ink-muted">
                {mode === 'password' && 'Enter your email and password.'}
                {mode === 'magic' && "Enter your email and we'll send you a one-time sign-in link."}
                {mode === 'forgot' && "Enter your email and we'll send a link to set a new password."}
              </p>
            </div>

            <Input
              type="email" name="email" label="Email address" placeholder="you@example.com" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              error={mode === 'password' ? undefined : error ?? undefined}
            />

            {mode === 'password' && (
              <Input
                type="password" name="password" label="Password" placeholder="••••••••" required
                value={password} onChange={(e) => setPassword(e.target.value)} error={error ?? undefined}
              />
            )}

            <Button type="submit" loading={busy} className="w-full">
              {mode === 'password' && 'Sign in'}
              {mode === 'magic' && 'Send me a sign-in link'}
              {mode === 'forgot' && 'Send reset link'}
            </Button>

            <div className="flex flex-col items-center gap-2 text-sm">
              {mode === 'password' && (
                <>
                  <button type="button" onClick={() => reset('forgot')} className="font-medium text-svgblue-500 hover:text-svgblue-700">Forgot password?</button>
                  <button type="button" onClick={() => reset('magic')} className="text-ink-muted hover:text-ink">Email me a sign-in link instead</button>
                </>
              )}
              {mode === 'magic' && (
                <button type="button" onClick={() => reset('password')} className="font-medium text-svgblue-500 hover:text-svgblue-700">Use my password instead</button>
              )}
              {mode === 'forgot' && (
                <button type="button" onClick={() => reset('password')} className="font-medium text-svgblue-500 hover:text-svgblue-700">Back to sign in</button>
              )}
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}
