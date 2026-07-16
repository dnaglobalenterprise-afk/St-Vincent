import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, MessageCircle, Mic, Workflow } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DiamondMotif } from '../../components/ui/DiamondMotif'
import { Seo } from '../../components/ui/Seo'
import { supabase } from '../../lib/supabase'
import type { ShowcaseEntry } from '../../lib/types'
import { DeployedBadge } from '../outcomes/DeployedBadge'
import { PUBLIC_SHOWCASE_COLUMNS, typeLabel } from '../outcomes/outcomes'

const STATS = [
  {
    number: '1',
    numberClass: 'text-svggreen-500',
    caption: 'real, verified project every graduate deploys at an SVG business — required to graduate',
  },
  {
    number: '8 weeks',
    numberClass: 'text-svgblue-500',
    caption: 'from beginner to a deployed system for a real business',
  },
  {
    number: '$0',
    numberClass: 'text-svgblue-500',
    caption: 'cost to students — admission by application',
  },
]

const STEPS = [
  {
    title: 'Apply',
    copy: 'Tell us who you are and why you finish what you start. Admission is by application, not payment.',
  },
  {
    title: 'Train',
    copy: 'Live online classes with instructors, weekly assignments, and an AI study coach in your corner.',
  },
  {
    title: 'Deploy',
    copy: 'Build a real system for a real SVG business and graduate with public proof it works.',
  },
]

const BUILDS = [
  {
    icon: MessageCircle,
    title: 'WhatsApp booking bots',
    copy: 'The Caribbean runs on WhatsApp — build bots that answer, book, and follow up.',
  },
  {
    icon: Workflow,
    title: 'Workflow automations',
    copy: 'Connect the tools businesses already use and remove hours of manual work.',
  },
  {
    icon: Mic,
    title: 'AI voice agents',
    copy: 'Agents that answer calls, take bookings, and text customers back.',
  },
]

function OutcomesTeaser() {
  const [stats, setStats] = useState<{ graduates: number; deployed: number; businesses: number } | null>(null)
  const [entries, setEntries] = useState<ShowcaseEntry[]>([])

  useEffect(() => {
    Promise.all([
      supabase.rpc('get_outcome_stats'),
      supabase.from('showcase_entries').select(PUBLIC_SHOWCASE_COLUMNS).eq('status', 'published').order('published_at', { ascending: false }).limit(3),
    ]).then(([{ data: s }, { data: e }]) => {
      if (s && s.length > 0) setStats(s[0])
      setEntries((e ?? []) as ShowcaseEntry[])
    })
  }, [])

  if (!stats || stats.deployed === 0) return null

  return (
    <section className="bg-surface-page">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-heading text-2xl font-semibold text-ink">Real proof, already shipping</h2>
            <p className="mt-1 text-base text-ink-muted">
              {stats.deployed} system{stats.deployed === 1 ? '' : 's'} deployed · {stats.graduates} graduate
              {stats.graduates === 1 ? '' : 's'} · {stats.businesses} business{stats.businesses === 1 ? '' : 'es'} served
            </p>
          </div>
          <Link to="/outcomes" className="font-medium text-svgblue-500 hover:text-svgblue-700">See the Outcomes Board →</Link>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {entries.map((e) => (
            <Link key={e.id} to={`/outcomes/${e.slug}`}>
              <Card className="h-full">
                <div className="flex items-center gap-2">
                  <DeployedBadge />
                </div>
                <p className="mt-2 font-heading text-lg font-semibold text-ink">{e.display_name}</p>
                <p className="text-sm text-ink-muted">{typeLabel(e.project_type)} · {e.business_name}, {e.island}</p>
                {e.headline && <p className="mt-2 text-base text-ink">{e.headline}</p>}
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export function HomePage() {
  return (
    <>
      <Seo
        title={null}
        description="A free, 8-week cohort program training Vincentian youth (18-30) to build and deploy AI automations, WhatsApp bots, and voice agents for real SVG businesses."
        path="/"
      />

      {/* 1. Hero */}
      <section className="relative overflow-hidden bg-surface-page">
        <DiamondMotif size={420} opacity={0.1} className="-right-24 top-8 hidden md:block" />
        <DiamondMotif size={300} opacity={0.06} className="-right-20 top-16 md:hidden" />
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 md:py-24">
          <Badge variant="gold">Free · Cohort-Based · Saint Vincent and the Grenadines</Badge>
          <h1 className="max-w-3xl font-heading text-3xl font-bold text-ink md:text-4xl">
            Learn AI. Build Real Systems. Get the Proof.
          </h1>
          <p className="max-w-2xl text-lg text-ink-muted">
            An 8-week program that trains young Vincentians to build AI automations, WhatsApp
            bots, and voice agents for real local businesses. Free to students. Proof you can show
            anyone.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/apply">
              <Button size="lg" className="w-full sm:w-auto">
                Apply for the Next Cohort
              </Button>
            </Link>
            <Link to="/businesses">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                I Own a Business
              </Button>
            </Link>
          </div>
          <p className="text-sm text-ink-muted">Built for Saint Vincent and the Grenadines 🇻🇨</p>
        </div>
      </section>

      {/* 2. Stats band */}
      <section className="bg-svgblue-50" aria-label="Key numbers">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-14 sm:grid-cols-3">
          {STATS.map((stat) => (
            <Card key={stat.number}>
              <p className={`font-heading text-4xl font-bold ${stat.numberClass}`}>{stat.number}</p>
              <p className="mt-2 text-base text-ink-muted">{stat.caption}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* 3. How it works */}
      <section className="bg-surface-page">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-heading text-2xl font-semibold text-ink">How it works</h2>
          <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex flex-col gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-svggold-500 font-heading text-base font-bold text-ink">
                  {i + 1}
                </span>
                <h3 className="font-heading text-xl font-semibold text-ink">{step.title}</h3>
                <p className="text-base text-ink-muted">{step.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. What you'll build */}
      <section className="bg-svgblue-50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-heading text-2xl font-semibold text-ink">What you&apos;ll build</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {BUILDS.map(({ icon: Icon, title, copy }) => (
              <Card key={title}>
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-svgblue-100">
                  <Icon className="h-6 w-6 text-svgblue-500" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-heading text-xl font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-base text-ink-muted">{copy}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 5. The Capstone promise */}
      <section className="bg-surface-page">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-16 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h2 className="font-heading text-2xl font-semibold text-ink">
              You don&apos;t graduate with a certificate. You graduate with a deployed system.
            </h2>
            <p className="text-base text-ink-muted">
              In weeks 7 and 8 you are matched with a registered SVG business. You build their
              automation, your instructor verifies it actually runs, and the finished project is
              published on our public Outcomes Board — a live portfolio anyone can check.
            </p>
            <p className="text-base text-ink-muted">
              That page is your proof: for employers, for clients, for anyone who asks what you can
              do.
            </p>
          </div>
          {/* Mock showcase card preview */}
          <Card
            className="md:justify-self-end md:w-full md:max-w-md"
            header={
              <div className="flex items-center justify-between">
                <span>Outcomes Board preview</span>
                <Badge variant="green">DEPLOYED</Badge>
              </div>
            }
          >
            <div className="flex flex-col gap-2">
              <p className="font-heading text-xl font-semibold text-ink">Kayla J. — Cohort 1</p>
              <p className="text-base font-medium text-svgblue-500">
                WhatsApp booking bot · Sunset View Guesthouse
              </p>
              <p className="text-base text-ink-muted">
                Guests now book rooms by WhatsApp in under two minutes — no missed inquiries.
              </p>
              <span className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-svggreen-700">
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                Verified by instructor
              </span>
            </div>
          </Card>
        </div>
      </section>

      {/* Outcomes teaser (only when there are published entries) */}
      <OutcomesTeaser />

      {/* 6. For businesses strip */}
      <section className="bg-svggreen-100">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-10 sm:flex-row sm:items-center">
          <p className="font-heading text-xl font-semibold text-ink">
            Own a business in SVG? Get a free automation built for you.
          </p>
          <Link to="/businesses" className="shrink-0">
            <Button variant="secondary">Register Your Business</Button>
          </Link>
        </div>
      </section>

      {/* 7. Backed by a bigger vision */}
      <section className="bg-surface-page">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="font-heading text-2xl font-semibold text-ink">Backed by a bigger vision</h2>
          <p className="mt-4 text-base text-ink-muted">
            Saint Vincent and the Grenadines is investing in its digital future. The SVG AI
            Institute is aligned with that national momentum — including the goals of the Ministry
            of Education, Vocational Training, Innovation, Digital Transformation and Information —
            turning AI skills into jobs, businesses, and public proof of what Vincentian youth can
            build.
          </p>
        </div>
      </section>

      {/* 8. Final CTA band */}
      <section className="relative overflow-hidden bg-gradient-to-r from-svgblue-500 to-svggreen-500">
        <DiamondMotif size={300} opacity={0.1} colorClass="text-white" className="-right-16 -top-8" />
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 sm:flex-row sm:items-center">
          <h2 className="font-heading text-2xl font-semibold text-white">
            The next cohort is forming.
          </h2>
          <Link to="/apply" className="shrink-0">
            <Button variant="secondary" size="lg" className="border-white bg-white">
              Apply Now
            </Button>
          </Link>
        </div>
      </section>
    </>
  )
}
