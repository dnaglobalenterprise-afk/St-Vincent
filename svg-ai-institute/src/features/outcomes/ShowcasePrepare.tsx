import { useCallback, useEffect, useState } from 'react'
import { Copy, Share2 } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import type { CapstoneProject, ShowcaseEntry } from '../../lib/types'
import { useAuth } from '../auth/useAuth'
import { validateFile } from '../learning/assignments'
import { DeployedBadge } from './DeployedBadge'
import { WA_SHARE, embedUrl, photoUrl, showcaseUrl, typeLabel } from './outcomes'

const MAX_PHOTO_BYTES = 10 * 1024 * 1024

export function ShowcasePrepare({ project }: { project: CapstoneProject }) {
  const { profile } = useAuth()
  const [entry, setEntry] = useState<ShowcaseEntry | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [narrative, setNarrative] = useState('')
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('showcase_entries').select('*').eq('project_id', project.id).maybeSingle()
    const e = data as ShowcaseEntry | null
    setEntry(e)
    setNarrative(e?.narrative ?? project.narrative ?? '')
    setPhotoPath(e?.photo_path ?? null)
    setLoaded(true)
  }, [project.id, project.narrative])

  useEffect(() => {
    void load()
  }, [load])

  if (!loaded) return <Card><div className="flex justify-center py-6"><Spinner /></div></Card>
  if (!entry) return null

  const uploadPhoto = async (file: File) => {
    const invalid = validateFile(file)
    if (invalid || file.size > MAX_PHOTO_BYTES || !file.type.startsWith('image/')) {
      setError('Photo must be an image under 10 MB.')
      return
    }
    setUploading(true)
    setError(null)
    const path = `${profile!.id}/${project.id}-${file.name.replace(/[^A-Za-z0-9._-]/g, '_')}`
    const { error: upErr } = await supabase.storage.from('showcase').upload(path, file, { upsert: true })
    setUploading(false)
    if (upErr) return setError('Photo upload failed.')
    setPhotoPath(path)
  }

  const approve = async () => {
    if (narrative.trim().length < 150) return setError('Your story needs at least 150 characters.')
    if (!consent) return setError('Please check the consent box to publish.')
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('approve_showcase', {
      p_entry_id: entry.id,
      p_narrative: narrative.trim(),
      p_photo_path: photoPath ?? '',
    })
    setBusy(false)
    if (err) return setError('Could not save. Please try again.')
    void load()
  }

  const decline = async () => {
    setBusy(true)
    await supabase.rpc('decline_showcase', { p_entry_id: entry.id })
    setBusy(false)
    void load()
  }

  // Published: show the live URL + share
  if (entry.status === 'published' && entry.slug) {
    const url = showcaseUrl(entry.slug)
    return (
      <Card className="bg-svggreen-100">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <DeployedBadge />
            <h3 className="font-heading text-lg font-semibold text-svggreen-700">Your showcase page is live!</h3>
          </div>
          <a href={`/outcomes/${entry.slug}`} target="_blank" rel="noopener noreferrer" className="break-all font-medium text-svgblue-500 underline">{url}</a>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => { void navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) }}>
              <Copy className="h-4 w-4" aria-hidden="true" /> {copied ? 'Copied!' : 'Copy link'}
            </Button>
            <a href={WA_SHARE(`I built a real AI system through the SVG AI Institute — see it here: ${url}`)} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="secondary"><Share2 className="h-4 w-4" aria-hidden="true" /> Share on WhatsApp</Button>
            </a>
          </div>
        </div>
      </Card>
    )
  }

  // Approved, waiting for staff to publish
  if (entry.status === 'approved') {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <Badge variant="green">Approved</Badge>
          <p className="text-base text-ink">Waiting for publication. Staff will publish your page to the Outcomes Board shortly.</p>
        </div>
      </Card>
    )
  }

  // awaiting_student or declined: the prepare + consent flow
  const embed = embedUrl(project.video_url)
  return (
    <Card header="Prepare your showcase page">
      <div className="flex flex-col gap-5">
        <p className="text-base text-ink-muted">Preview how your page will appear publicly, then approve it to go on the Outcomes Board.</p>

        {/* Preview */}
        <div className="rounded-xl border border-line bg-surface-alt p-4">
          <div className="flex items-center gap-2">
            <DeployedBadge />
            <Badge variant="blue">{typeLabel(project.type)}</Badge>
          </div>
          <p className="mt-2 font-heading text-xl font-semibold text-ink">
            {profile?.first_name} {profile?.last_name?.[0] ? `${profile.last_name[0]}.` : ''}
          </p>
          <p className="text-sm text-ink-muted">Built for a real SVG business</p>
          {embed && <iframe src={embed} title="preview" className="mt-3 aspect-video w-full rounded-lg" allowFullScreen />}
          {photoUrl(photoPath) && <img src={photoUrl(photoPath)!} alt="" className="mt-3 w-full rounded-lg" />}
        </div>

        {/* Editable narrative */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="showcase-narrative" className="text-sm font-medium text-ink">Your story (150+ chars, appears publicly)</label>
          <textarea id="showcase-narrative" rows={5} value={narrative} onChange={(e) => setNarrative(e.target.value)} className="w-full rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500" />
          <p className={`text-sm ${narrative.trim().length >= 150 ? 'text-svggreen-700' : 'text-ink-muted'}`}>{narrative.trim().length} / 150</p>
        </div>

        {/* Photo */}
        <div>
          <label className="cursor-pointer text-sm font-medium text-svgblue-500 underline">
            {uploading ? 'Uploading…' : photoPath ? 'Replace photo (optional)' : 'Add a photo (optional)'}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && void uploadPhoto(e.target.files[0])} />
          </label>
        </div>

        {/* Consent */}
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-4 py-3">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4" />
          <span className="text-base text-ink">I approve this page appearing publicly on the SVG AI Institute Outcomes Board, and understand I can request removal at any time.</span>
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2">
          <Button loading={busy} onClick={() => void approve()}>Approve my showcase</Button>
          <Button variant="ghost" className="text-ink-muted" loading={busy} onClick={() => void decline()}>Not now</Button>
        </div>
      </div>
    </Card>
  )
}
