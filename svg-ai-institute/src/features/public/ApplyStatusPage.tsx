import { useState } from 'react'
import type { FormEvent } from 'react'
import { PartyPopper, SearchX } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { Seo } from '../../components/ui/Seo'
import { supabase } from '../../lib/supabase'
import type { ApplicationStatus } from '../../lib/types'
import { isValidEmail } from './interestSignup'

type Result = { status: ApplicationStatus; first_name: string } | 'not_found' | null

export function ApplyStatusPage() {
  const [email, setEmail] = useState('')
  const [refCode, setRefCode] = useState('')
  const [errors, setErrors] = useState<{ email?: string; refCode?: string }>({})
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<Result>(null)
  const [checkError, setCheckError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors: { email?: string; refCode?: string } = {}
    if (!isValidEmail(email)) nextErrors.email = 'Enter a valid email address.'
    if (!refCode.trim()) nextErrors.refCode = 'Enter your reference code.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setChecking(true)
    setCheckError(null)
    setResult(null)
    const { data, error } = await supabase.rpc('check_application_status', {
      p_email: email,
      p_ref_code: refCode,
    })
    setChecking(false)
    if (error) {
      setCheckError('Something went wrong. Please try again.')
      return
    }
    setResult(data && data.length > 0 ? data[0] : 'not_found')
  }

  return (
    <>
      <Seo
        title="Application Status"
        description="Check the status of your SVG AI Institute application with your email and reference code."
        path="/apply/status"
      />
      <div className="mx-auto max-w-md px-4 py-12">
        <PageHeader
          title="Check Your Status"
          description="Enter the email you applied with and your SVG-XXXXX reference code."
        />
        <Card className="mt-8">
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4" noValidate>
            <Input
              label="Email"
              name="status-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />
            <Input
              label="Reference code"
              name="status-ref"
              placeholder="SVG-XXXXX"
              value={refCode}
              onChange={(e) => setRefCode(e.target.value.toUpperCase())}
              error={errors.refCode}
            />
            {checkError && <p className="text-sm text-danger">{checkError}</p>}
            <Button type="submit" loading={checking}>
              Check Status
            </Button>
          </form>
        </Card>

        {result === 'not_found' && (
          <Card className="mt-6">
            <EmptyState icon={SearchX} message="No application matches that email and code." />
          </Card>
        )}

        {result && result !== 'not_found' && (
          <div className="mt-6" data-testid="status-result">
            {(result.status === 'submitted' || result.status === 'under_review') && (
              <Card>
                <div className="flex flex-col gap-3">
                  <Badge variant={result.status === 'submitted' ? 'blue' : 'gold'} className="self-start">
                    {result.status === 'submitted' ? 'Submitted' : 'Under review'}
                  </Badge>
                  <p className="text-base text-ink">
                    Your application is in review. We&apos;ll email you when there&apos;s a
                    decision.
                  </p>
                </div>
              </Card>
            )}
            {result.status === 'accepted' && (
              <div className="rounded-xl bg-svggreen-100 px-6 py-8 text-center shadow-card">
                <PartyPopper className="mx-auto h-10 w-10 text-svggold-600" aria-hidden="true" />
                <h2 className="mt-3 font-heading text-2xl font-semibold text-svggreen-700">
                  You&apos;re in{result.first_name ? `, ${result.first_name}` : ''}.
                </h2>
                <p className="mt-2 text-base text-ink">
                  Check your email for your sign-in invitation.
                </p>
              </div>
            )}
            {result.status === 'waitlisted' && (
              <Card>
                <div className="flex flex-col gap-3">
                  <Badge variant="warning" className="self-start">
                    Waitlisted
                  </Badge>
                  <p className="text-base text-ink">
                    You&apos;re on the waitlist for this cohort. If a seat opens, we&apos;ll email
                    you.
                  </p>
                </div>
              </Card>
            )}
            {result.status === 'declined' && (
              <Card>
                <div className="flex flex-col gap-3">
                  <Badge variant="neutral" className="self-start">
                    Decision made
                  </Badge>
                  <p className="text-base text-ink">
                    We couldn&apos;t offer you a seat this cohort. You&apos;re welcome to apply
                    again next cohort.
                  </p>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  )
}
