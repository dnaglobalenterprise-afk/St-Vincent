import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Printer, ShieldX } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import { SITE_URL } from '../../lib/site'

export function CertificatePage() {
  const { code } = useParams<{ code: string }>()
  const [data, setData] = useState<{ holder_name: string; cohort_name: string; issued_at: string } | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!code) return
    supabase.rpc('verify_certificate', { p_code: code }).then(({ data: rows }) => {
      setData(rows && rows.length > 0 ? rows[0] : null)
      setLoaded(true)
    })
  }, [code])

  if (!loaded) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>

  if (!data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EmptyState icon={ShieldX} message="No certificate found for that code." action={<Link to="/verify"><Button>Verify a code</Button></Link>} />
      </div>
    )
  }

  const issued = new Date(data.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="bg-surface-alt py-8 print:bg-white print:py-0">
      <style>{`@media print { @page { size: A4 landscape; margin: 12mm; } .no-print { display: none !important; } body { background: #fff !important; } }`}</style>

      <div className="mx-auto max-w-4xl px-4 print:max-w-none print:px-0">
        <div className="no-print mb-6 flex justify-center">
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden="true" /> Download / Print
          </Button>
        </div>

        {/* Certificate */}
        <div className="relative overflow-hidden bg-white shadow-card print:shadow-none" style={{ aspectRatio: '297 / 210' }}>
          {/* Triple border */}
          <div className="absolute inset-3 border-4 border-svgblue-500" />
          <div className="absolute inset-4 border-2 border-svggold-500" />
          <div className="absolute inset-5 border border-svggreen-500" />
          {/* Diamond watermark */}
          <svg aria-hidden="true" viewBox="0 0 160 120" className="pointer-events-none absolute left-1/2 top-1/2 h-2/3 -translate-x-1/2 -translate-y-1/2 text-svggreen-500 opacity-[0.06]">
            <rect x="24" y="20" width="34" height="34" fill="currentColor" transform="rotate(45 41 37)" />
            <rect x="102" y="20" width="34" height="34" fill="currentColor" transform="rotate(45 119 37)" />
            <rect x="63" y="62" width="34" height="34" fill="currentColor" transform="rotate(45 80 79)" />
          </svg>

          <div className="relative flex h-full flex-col items-center justify-center px-[8%] text-center">
            <p className="font-heading text-lg font-bold uppercase tracking-widest text-svgblue-500">
              Saint Vincent AI &amp; Innovation Institute
            </p>
            <p className="mt-4 text-sm uppercase tracking-[0.3em] text-ink-muted">Certificate of Completion</p>
            <p className="mt-6 text-base text-ink-muted">This certifies that</p>
            <p className="mt-2 font-heading text-4xl font-bold text-ink md:text-5xl">{data.holder_name}</p>
            <p className="mt-4 max-w-xl text-base text-ink">
              has successfully completed the <span className="font-semibold">School of AI Automation — 8-Week Program</span>,
              building and deploying a verified AI system for a real business.
            </p>
            <p className="mt-4 text-base text-ink-muted">{data.cohort_name} · {issued}</p>

            <div className="mt-8 flex w-full items-end justify-between px-[4%]">
              <div className="text-left">
                <div className="h-px w-40 bg-ink" />
                <p className="mt-1 text-sm text-ink">Dom Cortez, Founder</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-ink-muted">Verify at {SITE_URL.replace(/^https?:\/\//, '')}/verify</p>
                <p className="font-heading text-base font-bold tracking-widest text-svgblue-500">{code}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
