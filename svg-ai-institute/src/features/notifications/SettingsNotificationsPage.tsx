import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import type { NotificationPrefs } from '../../lib/types'
import { useAuth } from '../auth/useAuth'

function PasswordCard() {
  const { profile } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setMsg(null)
    setError(null)
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setBusy(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (err) return setError(err.message)
    setPassword('')
    setConfirm('')
    setMsg('Password updated. You can now sign in with it.')
  }

  return (
    <Card header="Password">
      <p className="mb-4 text-sm text-ink-muted">
        Set a password so you can sign in without an email link. Signed in as <span className="font-medium text-ink">{profile?.email}</span>.
      </p>
      <div className="flex flex-col gap-4">
        <Input type="password" name="new-password" label="New password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Input type="password" name="confirm-password" label="Confirm password" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={error ?? undefined} />
        <Button className="self-start" loading={busy} disabled={!password} onClick={() => void save()}>Save password</Button>
        {msg && <p className="flex items-center gap-1.5 text-sm font-medium text-svggreen-700"><Check className="h-4 w-4" /> {msg}</p>}
      </div>
    </Card>
  )
}

type PrefKey = keyof Omit<NotificationPrefs, 'user_id'>

const TOGGLES: { key: PrefKey; label: string; desc: string }[] = [
  { key: 'email_reviews', label: 'Reviews & capstone updates', desc: 'When an assignment or capstone is reviewed, or your project publishes.' },
  { key: 'email_classes', label: 'Live class reminders', desc: 'An email about an hour before a live class starts.' },
  { key: 'email_announcements', label: 'Announcements', desc: 'Messages from your instructors to the cohort.' },
  { key: 'email_community', label: 'Community mentions', desc: 'When someone @mentions you in a channel.' },
]

export function SettingsNotificationsPage() {
  const { profile } = useAuth()
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!profile) return
    supabase.from('notification_prefs').select('*').eq('user_id', profile.id).maybeSingle().then(({ data }) => setPrefs(data))
  }, [profile])

  const toggle = async (key: PrefKey) => {
    if (!prefs || !profile) return
    const next = !prefs[key]
    setPrefs({ ...prefs, [key]: next })
    const patch: Partial<Omit<NotificationPrefs, 'user_id'>> = { [key]: next }
    await supabase.from('notification_prefs').update(patch).eq('user_id', profile.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title="Settings" description="Your password and email preferences." />

      <PasswordCard />

      <h2 className="font-heading text-lg font-semibold text-ink">Email preferences</h2>
      <p className="-mt-4 text-sm text-ink-muted">In-app notifications always work. These control email only.</p>
      {!prefs ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <Card>
          <div className="flex flex-col divide-y divide-line">
            {TOGGLES.map((t) => (
              <div key={t.key} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-heading text-base font-semibold text-ink">{t.label}</p>
                  <p className="text-sm text-ink-muted">{t.desc}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs[t.key]}
                  aria-label={t.label}
                  onClick={() => void toggle(t.key)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${prefs[t.key] ? 'bg-svggreen-500' : 'bg-line'}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${prefs[t.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            ))}
          </div>
          {saved && (
            <p className="mt-4 flex items-center gap-1.5 text-sm font-medium text-svggreen-700"><Check className="h-4 w-4" /> Saved</p>
          )}
        </Card>
      )}
    </div>
  )
}
