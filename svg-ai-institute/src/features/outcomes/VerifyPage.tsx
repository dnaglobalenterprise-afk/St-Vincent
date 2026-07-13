import { useState } from 'react'
import type { FormEvent } from 'react'
import { BadgeCheck, SearchX } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { Seo } from '../../components/ui/Seo'
import { supabase } from '../../lib/supabase'

type Result = { holder_name: string; cohort_name: string; issued_at: string } | 'not_found' | null

export function VerifyPage() {
  const [code, setCode] = useState('')
  const [result, setResult] = useState<Result>(null)
  const [checking, setChecking] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!code.trim()) return
    setChecking(true)
    setResult(null)
    const { data } = await supabase.rpc('verify_certificate', { p_code: code.trim() })
    setChecking(false)
    setResult(data && data.length > 0 ? data[0] : 'not_found')
  }

  return (
    <>
      <Seo title="Verify a Certificate" description="Confirm the authenticity of an SVG AI Institute certificate by its verification code." path="/verify" />
      <div className="mx-auto max-w-md px-4 py-12">
        <PageHeader title="Verify a Certificate" description="Enter the code printed on the certificate." />
        <Card className="mt-8">
          <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
            <Input name="cert-code" aria-label="Certificate code" placeholder="e.g. SVGAI-XXXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <Button type="submit" loading={checking}>Verify</Button>
          </form>
        </Card>

        {result === 'not_found' && (
          <Card className="mt-6">
            <div className="flex items-center gap-3">
              <SearchX className="h-6 w-6 text-ink-muted" aria-hidden="true" />
              <p className="text-base text-ink">No certificate found for that code.</p>
            </div>
          </Card>
        )}
        {result && result !== 'not_found' && (
          <div className="mt-6 rounded-xl bg-svggreen-100 px-6 py-6 text-center shadow-card">
            <BadgeCheck className="mx-auto h-10 w-10 text-svggreen-700" aria-hidden="true" />
            <h2 className="mt-2 font-heading text-2xl font-semibold text-svggreen-700">Valid certificate</h2>
            <p className="mt-3 text-base text-ink"><span className="font-semibold">{result.holder_name}</span></p>
            <p className="text-base text-ink-muted">{result.cohort_name}</p>
            <p className="text-sm text-ink-muted">Issued {new Date(result.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        )}
      </div>
    </>
  )
}
