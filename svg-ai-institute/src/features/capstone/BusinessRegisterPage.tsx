import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Info } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { Seo } from '../../components/ui/Seo'
import { supabase } from '../../lib/supabase'
import { isValidEmail } from '../public/interestSignup'
import { BUSINESS_TYPES, ISLANDS } from './capstone'

interface FormState {
  name: string
  business_type: string
  community: string
  island: string
  contact_name: string
  email: string
  whatsapp: string
  pain_point: string
  notes: string
  consent: boolean
}

const INITIAL: FormState = {
  name: '',
  business_type: BUSINESS_TYPES[0],
  community: '',
  island: ISLANDS[0],
  contact_name: '',
  email: '',
  whatsapp: '',
  pain_point: '',
  notes: '',
  consent: false,
}

type Errors = Partial<Record<keyof FormState, string>>

/**
 * Register a business partner. Because contacts live in their own table, we
 * insert the partner first, then the contact with the returned id. On contact
 * failure we surface a retry that only re-attempts the contact row.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  // reason: fallback only when crypto.randomUUID is unavailable (very old browsers)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export async function registerBusiness(
  form: FormState,
  existingBusinessId?: string,
): Promise<{ ok: true } | { ok: false; duplicate?: boolean; businessId?: string; message: string }> {
  // We generate the id client-side so we never need to SELECT the row back
  // (anonymous registrants have no read policy on business_partners).
  let businessId = existingBusinessId
  if (!businessId) {
    businessId = newId()
    const { error } = await supabase.from('business_partners').insert({
      id: businessId,
      status: 'pending',
      name: form.name.trim(),
      business_type: form.business_type,
      community: form.community.trim(),
      island: form.island,
      pain_point: form.pain_point.trim(),
      notes: form.notes.trim() || null,
      consent: form.consent,
    })
    if (error) {
      return { ok: false, message: 'Could not register. Please try again.' }
    }
  }
  const { error: contactErr } = await supabase.from('business_contacts').insert({
    business_id: businessId,
    contact_name: form.contact_name.trim(),
    email: form.email.trim().toLowerCase(),
    whatsapp: form.whatsapp.trim(),
  })
  if (contactErr) {
    if (contactErr.code === '23505') return { ok: false, duplicate: true, message: 'already registered' }
    return { ok: false, businessId, message: 'Saved your business, but the contact step failed. Retry?' }
  }
  return { ok: true }
}

export function BusinessRegisterPage() {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [duplicate, setDuplicate] = useState(false)
  const [retryBusinessId, setRetryBusinessId] = useState<string | undefined>()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const next: Errors = {}
    if (!form.name.trim()) next.name = 'Business name is required.'
    if (!form.community.trim()) next.community = 'Community/Town is required.'
    if (!form.contact_name.trim()) next.contact_name = 'Contact name is required.'
    if (!isValidEmail(form.email)) next.email = 'Enter a valid email address.'
    if (!form.whatsapp.trim()) next.whatsapp = 'WhatsApp number is required.'
    if (form.pain_point.trim().length < 100) next.pain_point = 'Tell us more — at least 100 characters.'
    if (!form.consent) next.consent = 'Please agree to continue.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitting(true)
    setSubmitError(null)
    const result = await registerBusiness(form, retryBusinessId)
    setSubmitting(false)
    if (result.ok) {
      setDone(true)
    } else if (result.duplicate) {
      setDuplicate(true)
    } else {
      setRetryBusinessId(result.businessId)
      setSubmitError(result.message)
    }
  }

  if (done) {
    return (
      <Shell>
        <div className="rounded-xl bg-svggreen-100 px-6 py-10 text-center shadow-card">
          <CheckCircle2 className="mx-auto h-12 w-12 text-svggreen-700" aria-hidden="true" />
          <h1 className="mt-4 font-heading text-2xl font-semibold text-svggreen-700">Thank you.</h1>
          <p className="mt-2 text-base text-ink">
            We review every business and reach out on WhatsApp when there&apos;s a student match.
          </p>
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
            <h1 className="font-heading text-2xl font-semibold text-ink">You&apos;re already registered.</h1>
            <p className="text-base text-ink-muted">
              We have your business on file and will reach out on WhatsApp. No need to register again.
            </p>
            <Link to="/businesses">
              <Button>Back to For Businesses</Button>
            </Link>
          </div>
        </Card>
      </Shell>
    )
  }

  return (
    <Shell>
      <PageHeader
        title="Register your business"
        description="Get a free automation built for you by a supervised student. Tell us about your business."
      />
      <Card className="mt-8">
        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
          <Input label="Business name" name="biz-name" value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Business type" name="biz-type" options={BUSINESS_TYPES} value={form.business_type} onChange={(v) => set('business_type', v)} />
            <Select label="Island" name="biz-island" options={ISLANDS} value={form.island} onChange={(v) => set('island', v)} />
          </div>
          <Input label="Community/Town" name="biz-community" value={form.community} onChange={(e) => set('community', e.target.value)} error={errors.community} />
          <Input label="Contact name" name="biz-contact" value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} error={errors.contact_name} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Email" name="biz-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} />
            <Input label="WhatsApp number" name="biz-whatsapp" type="tel" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} error={errors.whatsapp} />
          </div>
          <Textarea label="What eats your time or loses you customers?" name="biz-pain" min={100} value={form.pain_point} onChange={(v) => set('pain_point', v)} error={errors.pain_point} />
          <Textarea label="Anything students should know? (optional)" name="biz-notes" value={form.notes} onChange={(v) => set('notes', v)} />
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-4 py-3">
            <input type="checkbox" checked={form.consent} onChange={(e) => set('consent', e.target.checked)} className="mt-1 h-4 w-4" />
            <span className="text-base text-ink">
              I agree to a short discovery chat with a matched student and, if I approve the finished project, to it
              appearing on the public Outcomes Board.
            </span>
          </label>
          {errors.consent && <p className="text-sm text-danger">{errors.consent}</p>}
          {submitError && <p className="text-sm text-danger">{submitError}</p>}
          <Button type="submit" loading={submitting}>
            {retryBusinessId ? 'Retry contact details' : 'Register my business'}
          </Button>
        </form>
      </Card>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Seo
        title="Register Your Business"
        description="SVG businesses: register to receive a free WhatsApp bot, workflow automation, or voice agent built by a supervised student."
        path="/businesses/register"
      />
      <div className="mx-auto max-w-xl px-4 py-12">{children}</div>
    </>
  )
}

function Select({ label, name, options, value, onChange }: { label: string; name: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-ink">{label}</label>
      <select id={name} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function Textarea({ label, name, min, value, onChange, error }: { label: string; name: string; min?: number; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-ink">{label}</label>
      <textarea id={name} rows={4} value={value} onChange={(e) => onChange(e.target.value)} className={`w-full rounded-xl border bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500 ${error ? 'border-danger' : 'border-line'}`} />
      {min !== undefined && <p className={`text-sm ${value.trim().length >= min ? 'text-svggreen-700' : 'text-ink-muted'}`}>{value.trim().length} / {min} characters minimum</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  )
}
