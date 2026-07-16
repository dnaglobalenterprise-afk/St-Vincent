import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, MessageCircle, PhoneMissed, Map } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { Seo } from '../../components/ui/Seo'
import { isValidEmail, registerInterest } from './interestSignup'

const EXAMPLES = [
  {
    icon: MessageCircle,
    title: 'Guesthouse WhatsApp booking bot',
    copy: 'Answers guest questions, checks availability, and takes bookings on WhatsApp — day and night.',
  },
  {
    icon: PhoneMissed,
    title: 'Retail missed-call text-back',
    copy: 'Every missed call gets an instant text back, plus automatic review requests after purchase.',
  },
  {
    icon: Map,
    title: 'Tour operator inquiry-to-booking',
    copy: 'Turns inquiries from any channel into confirmed, scheduled bookings without manual back-and-forth.',
  },
]

const BUSINESS_TYPES = [
  'Tourism/Guesthouse',
  'Restaurant/Bar',
  'Retail',
  'Tours & Transport',
  'Services',
  'Other',
]

interface FormState {
  business_name: string
  contact_name: string
  email: string
  whatsapp: string
  business_type: string
  pain_point: string
}

const INITIAL: FormState = {
  business_name: '',
  contact_name: '',
  email: '',
  whatsapp: '',
  business_type: BUSINESS_TYPES[0],
  pain_point: '',
}

export function BusinessesPage() {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const set = (field: keyof FormState) => (value: string) => {
    setForm((f) => ({ ...f, [field]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors: Partial<Record<keyof FormState, string>> = {}
    if (!form.business_name.trim()) nextErrors.business_name = 'Business name is required.'
    if (!form.contact_name.trim()) nextErrors.contact_name = 'Contact name is required.'
    if (!isValidEmail(form.email)) nextErrors.email = 'Enter a valid email address.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    setSubmitError(null)
    const result = await registerInterest({
      audience: 'business',
      email: form.email,
      business_name: form.business_name.trim(),
      contact_name: form.contact_name.trim(),
      whatsapp: form.whatsapp.trim() || null,
      business_type: form.business_type,
      pain_point: form.pain_point.trim() || null,
    })
    setSubmitting(false)
    if (result.ok) {
      setDone(true)
    } else {
      setSubmitError(result.message)
    }
  }

  return (
    <>
      <Seo
        title="For Businesses"
        description="SVG businesses: get a free WhatsApp bot, workflow automation, or AI voice agent built by a supervised student of the SVG AI Institute. Register your interest."
        path="/businesses"
      />
      <div className="mx-auto max-w-4xl px-4 py-12">
        <PageHeader
          title="Get a Free Automation for Your Business"
          description="A supervised student builds you a WhatsApp bot, workflow automation, or voice agent — the build is free. Any ongoing running costs (your own WhatsApp Business number, per-message fees, or hosting) belong to your business, and we spell them out in plain numbers before anything goes live. You agree to a short discovery chat, give feedback along the way, and (with your approval) let the finished project appear on our public Outcomes Board."
          action={
            <Link to="/businesses/register">
              <Button>Register your business</Button>
            </Link>
          }
        />

        {/* Examples grid */}
        <section className="mt-12" aria-label="Example projects">
          <h2 className="font-heading text-2xl font-semibold text-ink">What we can build for you</h2>
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
            {EXAMPLES.map(({ icon: Icon, title, copy }) => (
              <Card key={title}>
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-svggreen-100">
                  <Icon className="h-6 w-6 text-svggreen-700" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-heading text-xl font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-base text-ink-muted">{copy}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Interest form */}
        <section className="mt-14" aria-label="Register interest">
          <div className="mx-auto max-w-lg">
            {done ? (
              <div className="rounded-xl bg-svggreen-100 px-6 py-8 text-center shadow-card">
                <CheckCircle2 className="mx-auto h-10 w-10 text-svggreen-700" aria-hidden="true" />
                <h2 className="mt-3 font-heading text-2xl font-semibold text-svggreen-700">
                  You&apos;re on the list.
                </h2>
                <p className="mt-2 text-base text-ink">
                  We&apos;ll reach out when student matching opens.
                </p>
              </div>
            ) : (
              <Card header="Register your business">
                <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4" noValidate>
                  <Input
                    label="Business name"
                    name="business_name"
                    required
                    value={form.business_name}
                    onChange={(e) => set('business_name')(e.target.value)}
                    error={errors.business_name}
                  />
                  <Input
                    label="Contact name"
                    name="contact_name"
                    required
                    value={form.contact_name}
                    onChange={(e) => set('contact_name')(e.target.value)}
                    error={errors.contact_name}
                  />
                  <Input
                    label="Email"
                    name="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => set('email')(e.target.value)}
                    error={errors.email}
                  />
                  <Input
                    label="WhatsApp number (optional)"
                    name="whatsapp"
                    type="tel"
                    value={form.whatsapp}
                    onChange={(e) => set('whatsapp')(e.target.value)}
                  />
                  <div className="flex w-full flex-col gap-1.5">
                    <label htmlFor="business_type" className="text-sm font-medium text-ink">
                      Business type
                    </label>
                    <select
                      id="business_type"
                      name="business_type"
                      value={form.business_type}
                      onChange={(e) => set('business_type')(e.target.value)}
                      className="w-full rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500"
                    >
                      {BUSINESS_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex w-full flex-col gap-1.5">
                    <label htmlFor="pain_point" className="text-sm font-medium text-ink">
                      What&apos;s your biggest time-waster? (optional)
                    </label>
                    <textarea
                      id="pain_point"
                      name="pain_point"
                      rows={3}
                      value={form.pain_point}
                      onChange={(e) => set('pain_point')(e.target.value)}
                      className="w-full rounded-xl border border-line bg-white px-4 py-2 text-base text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-svgblue-500"
                    />
                  </div>
                  {submitError && <p className="text-sm text-danger">{submitError}</p>}
                  <Button type="submit" loading={submitting} className="w-full">
                    Register Interest
                  </Button>
                </form>
              </Card>
            )}
          </div>
        </section>
      </div>
    </>
  )
}
