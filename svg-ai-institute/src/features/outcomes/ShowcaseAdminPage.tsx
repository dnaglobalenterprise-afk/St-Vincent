import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clapperboard, X } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import type { ShowcaseEntry } from '../../lib/types'
import { useAuth } from '../auth/useAuth'
import { Markdown } from '../learning/Markdown'
import { DeployedBadge } from './DeployedBadge'
import { photoUrl, slugify, typeLabel } from './outcomes'

type Tab = 'awaiting_student' | 'approved' | 'published' | 'declined'

const TAB_LABEL: Record<Tab, string> = {
  awaiting_student: 'Awaiting student',
  approved: 'Ready to publish',
  published: 'Published',
  declined: 'Declined',
}

export function ShowcaseAdminPage() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'
  const [entries, setEntries] = useState<ShowcaseEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('approved')
  const [selected, setSelected] = useState<ShowcaseEntry | null>(null)
  const [slug, setSlug] = useState('')
  const [headline, setHeadline] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const showToast = (kind: 'success' | 'error', text: string) => {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('showcase_entries').select('*').order('updated_at', { ascending: false })
    setEntries((data ?? []) as ShowcaseEntry[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => entries.filter((e) => e.status === tab), [entries, tab])

  const open = (e: ShowcaseEntry) => {
    setSelected(e)
    setSlug(e.slug ?? slugify(`${e.display_name ?? 'student'}-${typeLabel(e.project_type)}-${e.island ?? ''}`))
    setHeadline(e.headline ?? '')
  }

  const publish = async () => {
    if (!selected) return
    setBusy(true)
    const { error } = await supabase.rpc('publish_showcase', { p_entry_id: selected.id, p_slug: slug.trim(), p_headline: headline.trim() })
    setBusy(false)
    if (error) {
      showToast('error', error.message.includes('bad_slug') ? 'Slug must be 5-80 chars, lowercase/numbers/hyphens.' : error.message.includes('invalid_state') ? 'Needs student consent first.' : 'Could not publish.')
      return
    }
    showToast('success', 'Published to the Outcomes Board.')
    setSelected(null)
    void load()
  }

  const unpublish = async () => {
    if (!selected) return
    setBusy(true)
    const { error } = await supabase.rpc('unpublish_showcase', { p_entry_id: selected.id })
    setBusy(false)
    if (error) return showToast('error', 'Could not unpublish.')
    showToast('success', 'Removed from the board.')
    setSelected(null)
    void load()
  }

  const saveEdits = async () => {
    if (!selected) return
    setBusy(true)
    await supabase.from('showcase_entries').update({ headline: headline.trim() || null }).eq('id', selected.id)
    setBusy(false)
    showToast('success', 'Saved.')
    void load()
  }

  return (
    <div className="flex flex-col gap-6">
      {toast && (
        <div className={`fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-base font-medium shadow-card ${toast.kind === 'success' ? 'bg-svggreen-100 text-svggreen-700' : 'bg-svggold-100 text-danger'}`}>{toast.text}</div>
      )}
      <PageHeader title="Showcase" description="Curate and publish verified projects to the public Outcomes Board." />

      <div className="flex flex-wrap gap-2">
        {(['awaiting_student', 'approved', 'published', 'declined'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-xl px-4 py-2 text-base font-medium ${tab === t ? 'bg-svgblue-500 text-white' : 'bg-surface-alt text-ink hover:bg-svgblue-50'}`}>
            {TAB_LABEL[t]} ({entries.filter((e) => e.status === t).length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : visible.length === 0 ? (
        <Card><EmptyState icon={Clapperboard} message={`Nothing ${TAB_LABEL[tab].toLowerCase()}.`} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visible.map((e) => (
            <button key={e.id} type="button" onClick={() => open(e)} className="text-left">
              <Card>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-heading text-base font-semibold text-ink">{e.display_name ?? 'Awaiting consent'}</p>
                    <p className="text-sm text-ink-muted">{typeLabel(e.project_type)}{e.business_name ? ` · ${e.business_name}` : ''}</p>
                  </div>
                  {e.status === 'published' ? <DeployedBadge /> : <Badge variant={e.status === 'approved' ? 'green' : 'neutral'}>{TAB_LABEL[e.status as Tab]}</Badge>}
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-svgblue-900/30" onClick={() => setSelected(null)} role="presentation">
          <div role="dialog" aria-modal="true" className="h-full w-full overflow-y-auto bg-white shadow-card sm:max-w-lg" onClick={(ev) => ev.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between border-b border-line bg-white px-6 py-4">
              <h2 className="font-heading text-xl font-semibold text-ink">{selected.display_name ?? 'Showcase entry'}</h2>
              <button type="button" aria-label="Close" onClick={() => setSelected(null)} className="rounded-xl p-1.5 text-ink-muted hover:bg-svgblue-50"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex flex-col gap-4 px-6 py-6">
              {/* Public preview */}
              <div className="rounded-xl border border-line bg-surface-alt p-4">
                <div className="flex items-center gap-2">
                  <DeployedBadge />
                  <Badge variant="blue">{typeLabel(selected.project_type)}</Badge>
                </div>
                <p className="mt-2 font-heading text-lg font-semibold text-ink">{selected.display_name ?? '—'}</p>
                <p className="text-sm text-ink-muted">{selected.business_name} · {selected.island}</p>
                {photoUrl(selected.photo_path) && <img src={photoUrl(selected.photo_path)!} alt="" className="mt-2 w-full rounded-lg" />}
                {selected.narrative && <div className="mt-2"><Markdown source={selected.narrative} /></div>}
              </div>

              <p className="text-sm text-ink-muted">
                Consent: {selected.student_consent ? '✅ student approved' : '⏳ awaiting student'}
              </p>

              {selected.status !== 'published' && (
                <>
                  <Input label="Headline" name="sc-headline" value={headline} onChange={(e) => setHeadline(e.target.value)} />
                  <Input label="Slug (lowercase, hyphens)" name="sc-slug" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
                  <Button variant="ghost" size="sm" className="self-start" loading={busy} onClick={() => void saveEdits()}>Save edits</Button>
                </>
              )}

              {isAdmin && selected.status === 'approved' && (
                <Button variant="success" loading={busy} onClick={() => void publish()}>Publish to Outcomes Board</Button>
              )}
              {isAdmin && selected.status === 'published' && (
                <Button variant="ghost" className="text-danger" loading={busy} onClick={() => void unpublish()}>Unpublish (remove from board)</Button>
              )}
              {!isAdmin && <p className="text-sm text-ink-muted">Only admins can publish or unpublish.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
