import { Link } from 'react-router-dom'
import { CheckCircle2, Laptop, Wifi, Clock, Sparkles } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { Seo } from '../../components/ui/Seo'

const TIMELINE = [
  {
    weeks: '1-2',
    title: 'AI Fundamentals & Prompt Craft',
    copy: 'How modern AI actually works, and how to direct it with precision using Claude, ChatGPT, and Gemini.',
  },
  {
    weeks: '3',
    title: 'Visual Automation with Make',
    copy: 'Your first real automations — fast visual wins connecting apps without writing code.',
  },
  {
    weeks: '4-5',
    title: 'n8n + WhatsApp Automation',
    copy: 'The money skill. Build WhatsApp bots that answer, book, and follow up for real businesses.',
  },
  {
    weeks: '6',
    title: 'AI Voice Agents with VAPI',
    copy: 'The wow demo — agents that answer phone calls, take bookings, and text customers back.',
  },
  {
    weeks: '7-8',
    title: 'Capstone: build and deploy for a real SVG business',
    copy: 'Matched with a registered business, you build, deploy, and get instructor-verified. Optional website crash session included.',
  },
]

const NEEDS = [
  { icon: Laptop, text: 'A laptop or a reliable phone with a browser' },
  { icon: Wifi, text: 'Internet access' },
  { icon: Clock, text: 'Roughly 8-10 hours per week' },
  { icon: Sparkles, text: 'No coding experience required' },
]

export function ProgramPage() {
  return (
    <>
      <Seo
        title="Program"
        description="The School of AI Automation: an 8-week free program — AI fundamentals, Make, n8n + WhatsApp automation, VAPI voice agents, and a deployed capstone for a real SVG business."
        path="/program"
      />
      <div className="mx-auto max-w-4xl px-4 py-12">
        <PageHeader
          title="The Program — School of AI Automation"
          description="8 weeks. Live weekly classes with recordings, weekly assignments, an AI study coach, and a capstone deployed at a real SVG business. For ages 18-30. Free — admission by application."
        />

        {/* Week-by-week timeline */}
        <section className="mt-12" aria-label="Week-by-week timeline">
          <h2 className="font-heading text-2xl font-semibold text-ink">Week by week</h2>
          <ol className="relative mt-8 flex flex-col gap-8 border-l-2 border-svgblue-100 pl-8">
            {TIMELINE.map((item, i) => (
              <li key={item.weeks} className="relative">
                <span className="absolute -left-[52px] flex h-10 w-10 items-center justify-center rounded-full bg-svggold-500 font-heading text-sm font-bold text-ink">
                  {item.weeks}
                </span>
                <Card className={i % 2 === 1 ? 'bg-surface-alt' : ''}>
                  <p className="text-sm font-medium text-svgblue-500">Week {item.weeks}</p>
                  <h3 className="mt-1 font-heading text-xl font-semibold text-ink">{item.title}</h3>
                  <p className="mt-2 text-base text-ink-muted">{item.copy}</p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        {/* What you need */}
        <section className="mt-14">
          <h2 className="font-heading text-2xl font-semibold text-ink">What you need</h2>
          <Card className="mt-6">
            <ul className="flex flex-col gap-4">
              {NEEDS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-svgblue-100">
                    <Icon className="h-5 w-5 text-svgblue-500" aria-hidden="true" />
                  </span>
                  <span className="text-base text-ink">{text}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* What graduation requires */}
        <section className="mt-14">
          <h2 className="font-heading text-2xl font-semibold text-ink">What graduation requires</h2>
          <Card className="mt-6 border-l-4 border-l-svggreen-500">
            <ul className="flex flex-col gap-3">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-svggreen-500" aria-hidden="true" />
                <span className="text-base text-ink">Every weekly assignment completed</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-svggreen-500" aria-hidden="true" />
                <span className="text-base text-ink">One verified, deployed capstone at a real business</span>
              </li>
            </ul>
            <p className="mt-4 font-medium text-ink">This is a school for people who finish things.</p>
          </Card>
        </section>
      </div>

      {/* CTA band */}
      <section className="relative overflow-hidden bg-gradient-to-r from-svgblue-500 to-svggreen-500">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 sm:flex-row sm:items-center">
          <h2 className="font-heading text-2xl font-semibold text-white">Ready to build?</h2>
          <Link to="/apply" className="shrink-0">
            <Button variant="secondary" size="lg" className="border-white bg-white">
              Apply for the Next Cohort
            </Button>
          </Link>
        </div>
      </section>
    </>
  )
}
