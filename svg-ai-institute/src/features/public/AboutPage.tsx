import { UserRound, Users } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Seo } from '../../components/ui/Seo'
import { StudentInterestForm } from './StudentInterestForm'

export function AboutPage() {
  return (
    <>
      <Seo
        title="About"
        description="Why the SVG AI Institute exists: too many young Vincentians can't find work. We train builders, not certificate collectors — free to students — and every graduate ships a real, deployed project."
        path="/about"
      />
      <div className="mx-auto max-w-4xl px-4 py-12">
        <PageHeader title="Why This Exists" />

        {/* Mission narrative */}
        <section className="mt-8 flex max-w-3xl flex-col gap-4 text-base text-ink-muted">
          <p>
            Too many young Vincentians can&apos;t find work. That is not a statistic to us — it is
            the problem this school exists to attack.
          </p>
          <p>
            AI is the biggest economic equalizer in a generation. For the first time, a young
            Vincentian with a laptop and eight focused weeks can build the kind of automations
            businesses everywhere already pay for. The gap isn&apos;t talent — it&apos;s training and
            proof.
          </p>
          <p>
            The Institute trains builders, not certificate collectors. Every student graduates with
            a real system deployed at a real SVG business and a public showcase page proving it
            works.
          </p>
          <p>
            And this is only school one. The long-term vision includes schools for digital
            marketing, prompt engineering, and video products — an innovation ecosystem built in
            Saint Vincent, for Saint Vincent.
          </p>
        </section>

        {/* Founder card */}
        <section className="mt-14" aria-label="Founder">
          <h2 className="font-heading text-2xl font-semibold text-ink">Founder</h2>
          <Card className="mt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-svgblue-100">
                <UserRound className="h-8 w-8 text-svgblue-500" aria-hidden="true" />
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="font-heading text-xl font-semibold text-ink">Dom Cortez</h3>
                <p className="text-base font-medium text-svgblue-500">
                  Founder — DNA Global Enterprises
                </p>
                <p className="text-base text-ink-muted">
                  25+ years across transportation, logistics, and systems building. AI systems
                  operator.
                </p>
                <blockquote className="mt-2 border-l-4 border-svggold-500 pl-4 font-heading text-base font-semibold italic text-ink">
                  Faith. Family. Empire.
                </blockquote>
              </div>
            </div>
          </Card>
        </section>

        {/* Instructors */}
        <section className="mt-14" aria-label="Instructors">
          <h2 className="font-heading text-2xl font-semibold text-ink">Instructors</h2>
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card>
              <div className="flex flex-col gap-2">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-svgblue-100">
                  <UserRound className="h-6 w-6 text-svgblue-500" aria-hidden="true" />
                </span>
                <h3 className="mt-2 font-heading text-xl font-semibold text-ink">Dom Cortez</h3>
                <p className="text-sm font-medium text-svgblue-500">Founder & Lead Instructor</p>
                <p className="text-base text-ink-muted">
                  Builds AI systems daily across five brands — and teaches what actually ships.
                </p>
              </div>
            </Card>
            <Card>
              <EmptyState icon={Users} message="Instructor announcement coming soon" />
            </Card>
            <Card>
              <EmptyState icon={Users} message="Instructor announcement coming soon" />
            </Card>
          </div>
        </section>

        {/* Student interest capture */}
        <section className="mt-14" aria-label="Get notified">
          <Card header="Want to be notified when applications open?">
            <StudentInterestForm />
          </Card>
        </section>
      </div>
    </>
  )
}
