import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, Mail, X } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import type { BusinessPartner, BusinessStatus } from '../../lib/types'

type Tab = 'pending' | 'approved' | 'archived' | 'interest'

const STATUS_VARIANT: Record<BusinessStatus, 'gold' | 'green' | 'neutral'> = {
  pending: 'gold',
  approved: 'green',
  archived: 'neutral',
}

interface InterestRow {
  id: string
  email: string
  business_name: string | null
  contact_name: string | null
  whatsapp: string | null
  business_type: string | null
  pain_point: string | null
  converted: boolean
}

export function BusinessesAdminPage() {
  const [businesses, setBusinesses] = useState<BusinessPartner[]>([])
  const [contacts, setContacts] = useState<Record<string, { contact_name: string; email: string; whatsapp: string }>>({})
  const [interests, setInterests] = useState<InterestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('pending')
  const [selected, setSelected] = useState<BusinessPartner | null>(null)
  const [capacity, setCapacity] = useState('1')
  const [archiveReason, setArchiveReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [ownerActive, setOwnerActive] = useState(false)

  const showToast = (kind: 'success' | 'error', text: string) => {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: biz }, { data: cts }, { data: signups }] = await Promise.all([
      supabase.from('business_partners').select('*').order('created_at', { ascending: false }),
      supabase.from('business_contacts').select('*'),
      supabase.from('interest_signups').select('*').eq('audience', 'business').order('created_at', { ascending: false }),
    ])
    setBusinesses((biz ?? []) as BusinessPartner[])
    const cmap: Record<string, { contact_name: string; email: string; whatsapp: string }> = {}
    for (const c of cts ?? []) cmap[c.business_id] = { contact_name: c.contact_name, email: c.email, whatsapp: c.whatsapp }
    setContacts(cmap)
    setInterests((signups ?? []) as InterestRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(
    () => (tab === 'interest' ? [] : businesses.filter((b) => b.status === tab)),
    [businesses, tab],
  )

  const openDetail = (b: BusinessPartner) => {
    setSelected(b)
    setCapacity(String(b.capacity))
    setArchiveReason('')
    setOwnerActive(!!b.owner_user_id)
  }

  const approve = async () => {
    if (!selected) return
    setBusy(true)
    const { error } = await supabase
      .from('business_partners')
      .update({ status: 'approved', capacity: Math.min(3, Math.max(1, Number(capacity) || 1)) })
      .eq('id', selected.id)
    setBusy(false)
    if (error) return showToast('error', 'Could not approve.')
    showToast('success', 'Business approved.')
    setSelected(null)
    void load()
  }

  const archive = async () => {
    if (!selected || !archiveReason.trim()) return
    setBusy(true)
    const { error } = await supabase
      .from('business_partners')
      .update({ status: 'archived', archive_reason: archiveReason.trim() })
      .eq('id', selected.id)
    setBusy(false)
    if (error) return showToast('error', 'Could not archive.')
    showToast('success', 'Business archived.')
    setSelected(null)
    void load()
  }

  const inviteOwner = async () => {
    if (!selected) return
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('invite-business-owner', {
      body: { business_id: selected.id },
    })
    setBusy(false)
    if (error || !data?.ok) return showToast('error', 'Could not send the owner invite.')
    setOwnerActive(true)
    showToast('success', data.already ? 'Owner account already active.' : 'Owner invited by email.')
    void load()
  }

  return (
    <div className="flex flex-col gap-6">
      {toast && (
        <div className={`fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-base font-medium shadow-card ${toast.kind === 'success' ? 'bg-svggreen-100 text-svggreen-700' : 'bg-svggold-100 text-danger'}`}>
          {toast.text}
        </div>
      )}
      <PageHeader title="Businesses" description="Approve partners, set capacity, and invite owner accounts." />

      <div className="flex flex-wrap gap-2">
        {(['pending', 'approved', 'archived', 'interest'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-base font-medium capitalize ${tab === t ? 'bg-svgblue-500 text-white' : 'bg-surface-alt text-ink hover:bg-svgblue-50'}`}>
            {t === 'interest' ? 'From interest' : t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : tab === 'interest' ? (
        <InterestList interests={interests} onConverted={() => void load()} onToast={showToast} />
      ) : visible.length === 0 ? (
        <Card><EmptyState icon={Building2} message={`No ${tab} businesses.`} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visible.map((b) => (
            <button key={b.id} type="button" onClick={() => openDetail(b)} className="text-left">
              <Card>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-heading text-base font-semibold text-ink">{b.name}</p>
                    <p className="text-sm text-ink-muted">{b.island} · {contacts[b.id]?.contact_name ?? ''}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[b.status]}>{b.status}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{b.pain_point}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="blue">{b.business_type}</Badge>
                  {b.status === 'approved' && <Badge variant="neutral">Capacity {b.capacity}</Badge>}
                  {b.proposed_by && <Badge variant="gold">Student-proposed</Badge>}
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-svgblue-900/30" onClick={() => setSelected(null)} role="presentation">
          <div role="dialog" aria-modal="true" aria-label={selected.name} className="h-full w-full overflow-y-auto bg-white shadow-card sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between border-b border-line bg-white px-6 py-4">
              <h2 className="font-heading text-xl font-semibold text-ink">{selected.name}</h2>
              <button type="button" aria-label="Close" onClick={() => setSelected(null)} className="rounded-xl p-1.5 text-ink-muted hover:bg-svgblue-50">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-5 px-6 py-6">
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Type" value={selected.business_type} />
                <Field label="Island" value={selected.island} />
                <Field label="Community" value={selected.community} />
                <Field label="Contact" value={contacts[selected.id]?.contact_name} />
                <Field label="Email" value={contacts[selected.id]?.email} />
                <Field label="WhatsApp" value={contacts[selected.id]?.whatsapp} />
              </dl>
              <div>
                <p className="text-sm font-medium text-ink-muted">Pain point</p>
                <p className="text-base text-ink">{selected.pain_point}</p>
              </div>
              {selected.notes && (
                <div>
                  <p className="text-sm font-medium text-ink-muted">Notes</p>
                  <p className="text-base text-ink">{selected.notes}</p>
                </div>
              )}

              {selected.status === 'pending' && (
                <div className="flex flex-col gap-3 rounded-xl bg-surface-alt p-4">
                  <Input label="Capacity (concurrent projects, 1-3)" name="capacity" type="number" min={1} max={3} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
                  <Button variant="success" loading={busy} onClick={() => void approve()}>Approve</Button>
                </div>
              )}

              {selected.status === 'approved' && (
                <div className="flex flex-col gap-3 rounded-xl bg-surface-alt p-4">
                  <p className="text-sm font-medium text-ink">Capacity: {selected.capacity}</p>
                  {ownerActive ? (
                    <Badge variant="green">Owner account active</Badge>
                  ) : (
                    <Button variant="secondary" loading={busy} onClick={() => void inviteOwner()}>
                      <Mail className="h-4 w-4" aria-hidden="true" /> Invite owner account
                    </Button>
                  )}
                </div>
              )}

              {selected.status !== 'archived' && (
                <div className="flex flex-col gap-2 border-t border-line pt-4">
                  <Input label="Archive reason (internal)" name="archive-reason" value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} />
                  <Button variant="ghost" className="text-danger" disabled={!archiveReason.trim()} loading={busy} onClick={() => void archive()}>Archive</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-sm font-medium text-ink-muted">{label}</dt>
      <dd className="text-base text-ink">{value || '—'}</dd>
    </div>
  )
}

function InterestList({ interests, onConverted, onToast }: { interests: InterestRow[]; onConverted: () => void; onToast: (k: 'success' | 'error', t: string) => void }) {
  const [converting, setConverting] = useState<string | null>(null)

  // "Start registration" here converts the signup by creating a pending business
  // pre-filled from the signup, then flags the signup consumed.
  const convert = async (row: InterestRow) => {
    setConverting(row.id)
    const { data: biz, error } = await supabase
      .from('business_partners')
      .insert({
        status: 'pending',
        name: row.business_name ?? 'Unnamed business',
        business_type: row.business_type ?? 'Other',
        community: '—',
        island: 'St. Vincent',
        pain_point: row.pain_point ?? 'Converted from interest signup — please complete details.',
        consent: true,
      })
      .select('id')
      .single()
    if (error || !biz) {
      setConverting(null)
      return onToast('error', 'Could not convert.')
    }
    await supabase.from('business_contacts').insert({
      business_id: biz.id,
      contact_name: row.contact_name ?? 'Unknown',
      email: row.email,
      whatsapp: row.whatsapp ?? '',
    })
    await supabase.from('interest_signups').update({ converted: true }).eq('id', row.id)
    setConverting(null)
    onToast('success', 'Converted to a pending business.')
    onConverted()
  }

  const open = interests.filter((i) => !i.converted)
  if (open.length === 0) {
    return <Card><EmptyState icon={Mail} message="No unconverted business interest signups." /></Card>
  }
  return (
    <div className="flex flex-col gap-3">
      {open.map((row) => (
        <Card key={row.id}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-heading text-base font-semibold text-ink">{row.business_name ?? row.email}</p>
              <p className="text-sm text-ink-muted">{row.email}{row.business_type ? ` · ${row.business_type}` : ''}</p>
            </div>
            <Button size="sm" loading={converting === row.id} onClick={() => void convert(row)}>Start registration</Button>
          </div>
        </Card>
      ))}
    </div>
  )
}
