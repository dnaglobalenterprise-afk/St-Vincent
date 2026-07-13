import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, CheckCircle2, Copy, Info } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DiamondMotif } from '../../components/ui/DiamondMotif'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { Seo } from '../../components/ui/Seo'
import { supabase } from '../../lib/supabase'
import { isValidEmail } from './interestSignup'

const SVG = 'Saint Vincent and the Grenadines'

const COUNTRIES = [
  SVG,
  'Trinidad and Tobago',
  'Barbados',
  'Saint Lucia',
  'Grenada',
  'United States',
  'Canada',
  'United Kingdom',
  'Other',
]

const DEVICE_OPTIONS = [
  { value: 'laptop', label: 'Laptop' },
  { value: 'desktop', label: 'Desktop' },
  { value: 'phone_only', label: 'Phone only' },
  { value: 'shared', label: 'Shared computer' },
]

const INTERNET_OPTIONS = [
  { value: 'reliable', label: 'Reliable' },
  { value: 'sometimes', label: 'Sometimes drops' },
  { value: 'unreliable', label: 'Unreliable' },
]

const HOURS_OPTIONS = [
  { value: 'under_5', label: 'Under 5' },
  { value: '5_8', label: '5-8' },
  { value: '8_10', label: '8-10' },
  { value: '10_plus', label: '10+' },
]

const SITUATION_OPTIONS = ['Student', 'Employed', 'Self-employed', 'Unemployed', 'Other']
const HEARD_OPTIONS = ['WhatsApp', 'Facebook', 'Instagram', 'Friend/Family', 'News', 'Other']

interface FormState {
  first_name: string
  last_name: string
  email: string
  whatsapp: string
  date_of_birth: string
  community: string
  country: string
  device_access: string
  internet: string
  weekly_hours: string
  situation: string
  motivation: string
  finisher_story: string
  heard_from: string
  committed: boolean
}

const INITIAL: FormState = {
  first_name: '',
  last_name: '',
  email: '',
  whatsapp: '',
  date_of_birth: '',
  community: '',
  country: SVG,
  device_access: '',
  internet: '',
  weekly_hours: '',
  situation: '',
  motivation: '',
  finisher_story: '',
  heard_from: '',
  committed: false,
}

type Errors = Partial<Record<keyof FormState, string>>

function ageOn(dateOfBirth: string, today: Date): number {
  const dob = new Date(dateOfBirth + 'T00:00:00')
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
}

function validateStep1(f: FormState): Errors {
  const e: Errors = {}
  if (!f.first_name.trim()) e.first_name = 'First name is required.'
  if (!f.last_name.trim()) e.last_name = 'Last name is required.'
  if (!isValidEmail(f.email)) e.email = 'Enter a valid email address.'
  if (!f.whatsapp.trim()) e.whatsapp = 'WhatsApp number is required.'
  if (!f.date_of_birth) {
    e.date_of_birth = 'Date of birth is required.'
  } else {
    const age = ageOn(f.date_of_birth, new Date())
    if (age < 18 || age > 30) e.date_of_birth = 'This program is for ages 18-30'
  }
  if (!f.community.trim()) e.community = 'Community/Town is required.'
  return e
}

function validateStep2(f: FormState): Errors {
  const e: Errors = {}
  if (!f.device_access) e.device_access = 'Choose your device access.'
  if (!f.internet) e.internet = 'Choose your internet reliability.'
  if (!f.weekly_hours) e.weekly_hours = 'Choose your weekly hours.'
  if (!f.situation) e.situation = 'Choose your current situation.'
  return e
}

function validateStep3(f: FormState): Errors {
  const e: Errors = {}
  if (f.motivation.trim().length < 200) e.motivation = 'Tell us more — at least 200 characters.'
  if (f.finisher_story.trim().length < 100)
    e.finisher_story = 'Tell us more — at least 100 characters.'
  if (!f.committed) e.committed = 'You must confirm the commitment to apply.'
  return e
}

function RadioGroup({
  legend,
  name,
  options,
  value,
  onChange,
  error,
}: {
  legend: string
  name: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-ink">{legend}</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-base ${
              value === opt.value
                ? 'border-svgblue-500 bg-svgblue-50 text-svgblue-700'
                : 'border-line bg-white text-ink hover:border-svgblue-500'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="accent-current h-4 w-4"
            />
            {opt.label}
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </fieldset>
  )
}

function Select({
  label,
  name,
  options,
  value,
  onChange,
  error,
}: {
  label: string
  name: string
  options: string[]
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-ink">
        {label}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o || 'Choose…'}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  )
}

function CountedTextarea({
  label,
  name,
  min,
  value,
  onChange,
  error,
}: {
  label: string
  name: string
  min: number
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500 ${
          error ? 'border-danger' : 'border-line'
        }`}
      />
      <p className={`text-sm ${value.trim().length >= min ? 'text-svggreen-700' : 'text-ink-muted'}`}>
        {value.trim().length} / {min} characters minimum
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  )
}

const STEP_TITLES = ['About you', 'Readiness', 'Motivation']

function Progress({ step }: { step: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        {STEP_TITLES.map((title, i) => {
          const n = i + 1
          const complete = step > n
          const current = step === n
          return (
            <div key={title} className="flex items-center gap-2">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full font-heading text-sm font-bold ${
                  complete
                    ? 'bg-svggold-500 text-ink'
                    : current
                      ? 'bg-svgblue-500 text-white'
                      : 'bg-svgblue-100 text-svgblue-700'
                }`}
              >
                {complete ? <Check className="h-4 w-4" aria-hidden="true" /> : n}
              </span>
              <span className={`hidden text-sm font-medium sm:block ${current ? 'text-ink' : 'text-ink-muted'}`}>
                {title}
              </span>
            </div>
          )
        })}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-svgblue-100" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={3}>
        <div
          className="h-full bg-svgblue-500 transition-all duration-200"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>
    </div>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <Seo
        title="Apply"
        description="Apply to the SVG AI Institute: a free 8-week program for Vincentians aged 18-30. Build and deploy real AI systems for real businesses."
        path="/apply"
      />
      <div className="relative overflow-hidden bg-svgblue-50">
        <DiamondMotif size={300} opacity={0.08} className="-right-16 top-10" />
        <DiamondMotif size={220} opacity={0.06} className="-left-16 bottom-10" />
        <div className="relative mx-auto max-w-xl px-4 py-12">{children}</div>
      </div>
    </>
  )
}

export function ApplyPage() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>(INITIAL)
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)
  const [refCode, setRefCode] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [field]: value }))
  }

  const next = () => {
    const stepErrors = step === 1 ? validateStep1(form) : validateStep2(form)
    setErrors(stepErrors)
    if (Object.keys(stepErrors).length === 0) setStep(step + 1)
  }

  const submit = async () => {
    const stepErrors = validateStep3(form)
    setErrors(stepErrors)
    if (Object.keys(stepErrors).length > 0) return
    setSubmitting(true)
    setSubmitError(null)
    const { data, error } = await supabase.rpc('submit_application', {
      p: {
        ...form,
        email: form.email.trim().toLowerCase(),
        heard_from: form.heard_from || null,
      },
    })
    setSubmitting(false)
    if (error) {
      if (error.code === '23505') setDuplicate(true)
      else setSubmitError('Something went wrong. Please try again.')
      return
    }
    setRefCode(data)
  }

  const copyCode = async () => {
    if (!refCode) return
    await navigator.clipboard.writeText(refCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (refCode) {
    return (
      <Shell>
        <div className="rounded-xl bg-svggreen-100 px-6 py-10 text-center shadow-card">
          <CheckCircle2 className="mx-auto h-12 w-12 text-svggreen-700" aria-hidden="true" />
          <h1 className="mt-4 font-heading text-2xl font-semibold text-svggreen-700">
            Application received.
          </h1>
          <p className="mt-6 text-sm font-medium uppercase tracking-wide text-ink-muted">
            Your reference code
          </p>
          <p className="mt-1 font-heading text-4xl font-bold text-ink" data-testid="ref-code">
            {refCode}
          </p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => void copyCode()}>
            <Copy className="h-4 w-4" aria-hidden="true" />
            {copied ? 'Copied!' : 'Copy code'}
          </Button>
          <p className="mt-6 text-base text-ink">
            Save this code. Use it with your email to check your status.
          </p>
          <Link
            to="/apply/status"
            className="mt-2 inline-block font-medium text-svgblue-500 hover:text-svgblue-700"
          >
            Check your status →
          </Link>
        </div>
      </Shell>
    )
  }

  if (duplicate) {
    return (
      <Shell>
        <Card>
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <Info className="h-10 w-10 text-svgblue-500" aria-hidden="true" />
            <h1 className="font-heading text-2xl font-semibold text-ink">
              You&apos;ve already applied.
            </h1>
            <p className="text-base text-ink-muted">
              We have an application for this email on file. Check your status below.
            </p>
            <Link to="/apply/status">
              <Button>Check your status</Button>
            </Link>
          </div>
        </Card>
      </Shell>
    )
  }

  return (
    <Shell>
      <PageHeader
        title="Apply — Cohort 1"
        description="Free, 8 weeks, ages 18-30. Three quick steps."
      />
      <Card className="mt-8">
        <div className="flex flex-col gap-6">
          <Progress step={step} />

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="First name"
                  name="first_name"
                  value={form.first_name}
                  onChange={(e) => set('first_name', e.target.value)}
                  error={errors.first_name}
                />
                <Input
                  label="Last name"
                  name="last_name"
                  value={form.last_name}
                  onChange={(e) => set('last_name', e.target.value)}
                  error={errors.last_name}
                />
              </div>
              <Input
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                error={errors.email}
              />
              <Input
                label="WhatsApp number"
                name="whatsapp"
                type="tel"
                value={form.whatsapp}
                onChange={(e) => set('whatsapp', e.target.value)}
                error={errors.whatsapp}
              />
              <Input
                label="Date of birth"
                name="date_of_birth"
                type="date"
                value={form.date_of_birth}
                onChange={(e) => set('date_of_birth', e.target.value)}
                error={errors.date_of_birth}
              />
              <Input
                label="Community/Town"
                name="community"
                value={form.community}
                onChange={(e) => set('community', e.target.value)}
                error={errors.community}
              />
              <Select
                label="Country"
                name="country"
                options={COUNTRIES}
                value={form.country}
                onChange={(v) => set('country', v)}
              />
              {form.country !== SVG && (
                <div className="flex items-start gap-2 rounded-xl bg-svgblue-50 px-4 py-3">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-svgblue-500" aria-hidden="true" />
                  <p className="text-sm text-ink-muted">
                    Cohort 1 prioritizes SVG residents; diaspora applications are waitlisted by
                    default.
                  </p>
                </div>
              )}
              <Button onClick={next}>Continue</Button>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-5">
              <RadioGroup
                legend="Device access"
                name="device_access"
                options={DEVICE_OPTIONS}
                value={form.device_access}
                onChange={(v) => set('device_access', v)}
                error={errors.device_access}
              />
              <RadioGroup
                legend="Internet reliability"
                name="internet"
                options={INTERNET_OPTIONS}
                value={form.internet}
                onChange={(v) => set('internet', v)}
                error={errors.internet}
              />
              <RadioGroup
                legend="Weekly hours you can commit (the program needs 8-10)"
                name="weekly_hours"
                options={HOURS_OPTIONS}
                value={form.weekly_hours}
                onChange={(v) => set('weekly_hours', v)}
                error={errors.weekly_hours}
              />
              <Select
                label="Current situation"
                name="situation"
                options={['', ...SITUATION_OPTIONS]}
                value={form.situation}
                onChange={(v) => set('situation', v)}
                error={errors.situation}
              />
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button className="flex-1" onClick={next}>
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-5">
              <CountedTextarea
                label="Why do you want to join?"
                name="motivation"
                min={200}
                value={form.motivation}
                onChange={(v) => set('motivation', v)}
                error={errors.motivation}
              />
              <CountedTextarea
                label="Tell us about something you finished that you're proud of"
                name="finisher_story"
                min={100}
                value={form.finisher_story}
                onChange={(v) => set('finisher_story', v)}
                error={errors.finisher_story}
              />
              <Select
                label="How did you hear about us?"
                name="heard_from"
                options={['', ...HEARD_OPTIONS]}
                value={form.heard_from}
                onChange={(v) => set('heard_from', v)}
              />
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-4 py-3">
                <input
                  type="checkbox"
                  name="committed"
                  checked={form.committed}
                  onChange={(e) => set('committed', e.target.checked)}
                  className="mt-1 h-4 w-4"
                />
                <span className="text-base text-ink">
                  I understand this is an 8-week program requiring 8-10 hours per week and a real
                  deployed project to graduate.
                </span>
              </label>
              {errors.committed && <p className="text-sm text-danger">{errors.committed}</p>}
              {submitError && <p className="text-sm text-danger">{submitError}</p>}
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button className="flex-1" loading={submitting} onClick={() => void submit()}>
                  Submit Application
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
      <p className="mt-4 text-center text-sm text-ink-muted">
        Already applied?{' '}
        <Link to="/apply/status" className="font-medium text-svgblue-500 hover:text-svgblue-700">
          Check your status
        </Link>
      </p>
    </Shell>
  )
}
