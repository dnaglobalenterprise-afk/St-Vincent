import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import type { NotificationPrefs } from '../../lib/types'
import { useAuth } from '../auth/useAuth'

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
      <PageHeader title="Email preferences" description="In-app notifications always work. These control email only." />
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
