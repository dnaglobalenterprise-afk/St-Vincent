import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { MailCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DiamondMotif } from '../../components/ui/DiamondMotif'
import { Input } from '../../components/ui/Input'

const RESEND_COOLDOWN_SECONDS = 30

export function SignInPage() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((s) => s - 1), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const sendLink = async () => {
    setSending(true)
    setError(null)

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/auth/callback' },
    })

    setSending(false)

    if (otpError) {
      setError(otpError.message)
      return
    }

    setSent(true)
    setCooldown(RESEND_COOLDOWN_SECONDS)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void sendLink()
  }

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-svgblue-50 px-4 py-16">
      <DiamondMotif size={320} className="-top-6 left-1/2 -translate-x-1/2" />
      <DiamondMotif size={200} opacity={0.08} className="bottom-4 -left-16" />
      <DiamondMotif size={200} opacity={0.08} className="-right-16 bottom-20" />

      <Card className="relative w-full max-w-md">
        {sent ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-svggreen-100">
              <MailCheck className="h-7 w-7 text-svggreen-500" aria-hidden="true" />
            </span>
            <h1 className="font-heading text-2xl font-semibold text-ink">Check your email</h1>
            <p className="text-base text-ink-muted">
              We sent a sign-in link to <span className="font-medium text-ink">{email}</span>. Click
              it to sign in.
            </p>
            <Button
              variant="ghost"
              size="sm"
              disabled={cooldown > 0}
              loading={sending}
              onClick={() => void sendLink()}
            >
              {cooldown > 0 ? `Resend link in ${cooldown}s` : 'Resend link'}
            </Button>
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 py-2">
            <div className="flex flex-col gap-2">
              <h1 className="font-heading text-2xl font-semibold text-ink">Sign in</h1>
              <p className="text-base text-ink-muted">
                Enter your email and we&apos;ll send you a magic sign-in link. No password needed.
              </p>
            </div>
            <Input
              type="email"
              name="email"
              label="Email address"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={error ?? undefined}
            />
            <Button type="submit" loading={sending} className="w-full">
              Send me a sign-in link
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
