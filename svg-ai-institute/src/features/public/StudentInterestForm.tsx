import { useState } from 'react'
import type { FormEvent } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { isValidEmail, registerInterest } from './interestSignup'

/**
 * Email-only interest capture for prospective students. Used on /about and
 * /apply; inserts into interest_signups with audience = 'student'.
 */
export function StudentInterestForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.')
      return
    }
    setError(null)
    setSubmitting(true)
    const result = await registerInterest({ audience: 'student', email })
    setSubmitting(false)
    if (result.ok) {
      setDone(true)
    } else {
      setError(result.message)
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-svggreen-100 px-4 py-4">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-svggreen-700" aria-hidden="true" />
        <p className="text-base font-medium text-svggreen-700">
          You&apos;re on the list. We&apos;ll email you when applications open.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex-1">
        <Input
          type="email"
          name="student-email"
          aria-label="Email address"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error ?? undefined}
          required
        />
      </div>
      <Button type="submit" loading={submitting} className="sm:shrink-0">
        Notify Me
      </Button>
    </form>
  )
}
