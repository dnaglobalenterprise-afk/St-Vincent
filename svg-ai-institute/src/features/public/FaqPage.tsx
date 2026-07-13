import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Seo } from '../../components/ui/Seo'

const FAQS = [
  {
    q: 'How much does it cost?',
    a: 'Nothing — the program is free at launch. Admission is by application, so places go to people who show they will finish.',
  },
  {
    q: 'Who can apply?',
    a: 'Vincentians aged 18-30, based in Saint Vincent and the Grenadines. Diaspora applicants may be considered in later cohorts.',
  },
  {
    q: 'Do I need coding experience?',
    a: 'No. You need commitment and roughly 8-10 hours a week. The tools we teach are built for non-programmers — and we take you further than most programmers get with them.',
  },
  {
    q: 'Is this online?',
    a: 'Yes, fully online: live weekly classes plus recordings you can rewatch anytime.',
  },
  {
    q: 'What do I graduate with?',
    a: 'A verified, deployed system running at a real business, a public showcase page proving it, and a certificate.',
  },
  {
    q: 'What tools will I learn?',
    a: 'Claude and modern AI models, Make, n8n, WhatsApp automation, and VAPI voice agents.',
  },
  {
    q: 'Can I do this from a phone?',
    a: 'Partially. Lessons and community work on a phone, but a laptop is strongly recommended for the build weeks.',
  },
  {
    q: 'What happens if I fall behind?',
    a: 'Progression gates and instructors keep you on pace. The program is built to reward finishers — falling behind triggers help, not silence.',
  },
  {
    q: 'I own a business — how do I get a free automation?',
    a: 'Register on the For Businesses page. When student matching opens, we reach out to schedule a short discovery chat.',
  },
  {
    q: 'Who runs this?',
    a: 'Founded by Dom Cortez (DNA Global Enterprises) with volunteer instructors from SVG and the diaspora.',
  },
]

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false)
  const panelId = `faq-panel-${index}`
  const buttonId = `faq-button-${index}`

  return (
    <div className="rounded-xl border border-line bg-white shadow-card">
      <button
        type="button"
        id={buttonId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 rounded-xl px-6 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-svgblue-500"
      >
        <span className="font-heading text-base font-semibold text-ink">{q}</span>
        <ChevronDown
          aria-hidden="true"
          className={`h-5 w-5 shrink-0 text-svgblue-500 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <div id={panelId} role="region" aria-labelledby={buttonId} className="px-6 pb-5">
          <p className="text-base text-ink-muted">{a}</p>
        </div>
      )}
    </div>
  )
}

export function FaqPage() {
  return (
    <>
      <Seo
        title="FAQ"
        description="Frequently asked questions about the SVG AI Institute: cost (free), eligibility (ages 18-30, SVG-based), tools taught, graduation requirements, and more."
        path="/faq"
      />
      <div className="mx-auto max-w-3xl px-4 py-12">
        <PageHeader
          title="Frequently Asked Questions"
          description="Everything applicants and business partners ask us most."
        />
        <div className="mt-10 flex flex-col gap-4">
          {FAQS.map((faq, i) => (
            <FaqItem key={faq.q} q={faq.q} a={faq.a} index={i} />
          ))}
        </div>
      </div>
    </>
  )
}
