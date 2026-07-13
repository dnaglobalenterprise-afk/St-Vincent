import { useEffect, useState } from 'react'
import { Check, Copy, Eye, EyeOff } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'

export function GoLivePanel({ classId }: { classId: string }) {
  const [rtmp, setRtmp] = useState<string | null>(null)
  const [streamKey, setStreamKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc('get_stream_credentials', { p_class_id: classId }).then(({ data, error: err }) => {
      if (err) {
        setError('Could not load stream credentials.')
      } else if (data && data.length > 0) {
        setRtmp(data[0].rtmp_url)
        setStreamKey(data[0].stream_key)
      } else {
        setError('Stream not provisioned yet.')
      }
      setLoading(false)
    })
  }, [classId])

  const copy = async (value: string, which: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(which)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) return <Spinner />
  if (error) return <p className="text-sm text-warning">{error}</p>

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-svgblue-50 p-4">
      <p className="text-base font-semibold text-ink">Broadcast with OBS</p>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink-muted">RTMP Server URL</span>
        <div className="flex items-center gap-2">
          <code className="flex-1 break-all rounded-lg bg-white px-3 py-2 text-sm text-ink">{rtmp}</code>
          <Button variant="ghost" size="sm" onClick={() => rtmp && void copy(rtmp, 'rtmp')}>
            {copied === 'rtmp' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink-muted">Stream Key</span>
        <div className="flex items-center gap-2">
          <code className="flex-1 break-all rounded-lg bg-white px-3 py-2 text-sm text-ink">
            {revealed ? streamKey : '•'.repeat(28)}
          </code>
          <Button variant="ghost" size="sm" onClick={() => setRevealed((r) => !r)}>
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => streamKey && void copy(streamKey, 'key')}>
            {copied === 'key' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <ol className="flex flex-col gap-1 text-sm text-ink-muted">
        <li>1. In OBS: Settings → Stream → Service &ldquo;Custom&rdquo;.</li>
        <li>2. Paste the RTMP URL as the Server and the Stream Key as the Key.</li>
        <li>3. Click &ldquo;Start Streaming&rdquo; — the class flips to LIVE automatically.</li>
      </ol>
    </div>
  )
}
