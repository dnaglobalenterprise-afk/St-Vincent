import { useCallback, useEffect, useState } from 'react'
import { Building2 } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import type { BusinessPartner, CapstoneProject } from '../../lib/types'
import { useAuth } from '../auth/useAuth'
import { CAPSTONE_STATUS_META, CAPSTONE_TYPE_LABELS, TIMELINE_STEPS, timelineIndex } from './capstone'

export function PartnerPortalPage() {
  const { profile } = useAuth()
  const [business, setBusiness] = useState<BusinessPartner | null>(null)
  const [projects, setProjects] = useState<CapstoneProject[]>([])
  const [studentNames, setStudentNames] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)
  const [whatsapp, setWhatsapp] = useState('')
  const [pain, setPain] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    if (!profile) return
    const { data: biz } = await supabase.from('business_partners').select('*').eq('owner_user_id', profile.id).maybeSingle()
    setBusiness(biz as BusinessPartner | null)
    if (biz) {
      setPain(biz.pain_point)
      const { data: contact } = await supabase.from('business_contacts').select('whatsapp').eq('business_id', biz.id).maybeSingle()
      setWhatsapp(contact?.whatsapp ?? '')
      const { data: projs } = await supabase.from('capstone_projects').select('*').eq('business_id', biz.id).order('created_at', { ascending: false })
      setProjects((projs ?? []) as CapstoneProject[])
      const ids = [...new Set((projs ?? []).map((p) => p.user_id))]
      if (ids.length) {
        const { data: profiles } = await supabase.from('profiles').select('id, first_name').in('id', ids)
        setStudentNames(Object.fromEntries((profiles ?? []).map((p) => [p.id, p.first_name ?? 'Student'])))
      }
    }
    setLoaded(true)
  }, [profile])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    if (!business) return
    setSaving(true)
    await supabase.from('business_partners').update({ pain_point: pain.trim() }).eq('id', business.id)
    await supabase.from('business_contacts').update({ whatsapp: whatsapp.trim() }).eq('business_id', business.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (!loaded) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>

  if (!business) {
    return <Card><EmptyState icon={Building2} message="No business is linked to your account yet." /></Card>
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={business.name} description="Your business and the projects our students are building for you." />

      <Card header="Your business">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="blue">{business.business_type}</Badge>
            <Badge variant="neutral">{business.island}</Badge>
            <Badge variant={business.status === 'approved' ? 'green' : 'neutral'}>{business.status}</Badge>
          </div>
          <Input label="WhatsApp number" name="partner-whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="partner-pain" className="text-sm font-medium text-ink">What eats your time or loses you customers?</label>
            <textarea id="partner-pain" rows={3} value={pain} onChange={(e) => setPain(e.target.value)} className="w-full rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500" />
          </div>
          <Button className="self-start" size="sm" loading={saving} onClick={() => void save()}>{saved ? 'Saved ✓' : 'Save changes'}</Button>
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold text-ink">Your projects</h2>
        {projects.length === 0 ? (
          <Card><EmptyState icon={Building2} message="No student is matched with you yet. We'll be in touch on WhatsApp." /></Card>
        ) : (
          projects.map((p) => {
            const step = timelineIndex(p.status)
            const meta = CAPSTONE_STATUS_META[p.status]
            return (
              <Card key={p.id}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-heading text-base font-semibold text-ink">{studentNames[p.user_id] ?? 'Student'}</p>
                    <p className="text-sm text-ink-muted">{CAPSTONE_TYPE_LABELS[p.type]}</p>
                  </div>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  {TIMELINE_STEPS.map((s, i) => (
                    <div key={s.key} className="flex flex-1 flex-col items-center gap-1 text-center">
                      <span className={`h-2.5 w-2.5 rounded-full ${step > i ? 'bg-svggreen-500' : step === i ? 'bg-svgblue-500' : 'bg-svgblue-100'}`} />
                      <span className="text-xs text-ink-muted">{s.label}</span>
                    </div>
                  ))}
                </div>
                {p.status === 'verified' && p.video_url && (
                  <a href={p.video_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-medium text-svgblue-500 underline">
                    Watch what they built
                  </a>
                )}
              </Card>
            )
          })
        )}
      </section>
    </div>
  )
}
