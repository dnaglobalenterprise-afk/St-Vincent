import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Seo } from '../../components/ui/Seo'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import type { ShowcaseEntry } from '../../lib/types'
import { Markdown } from '../learning/Markdown'
import { DeployedBadge } from './DeployedBadge'
import { PUBLIC_SHOWCASE_COLUMNS, embedUrl, photoUrl, typeLabel } from './outcomes'

export function ShowcasePage() {
  const { slug } = useParams<{ slug: string }>()
  const [entry, setEntry] = useState<ShowcaseEntry | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!slug) return
    supabase
      .from('showcase_entries')
      .select(PUBLIC_SHOWCASE_COLUMNS)
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()
      .then(({ data }) => {
        setEntry(data as ShowcaseEntry | null)
        setLoaded(true)
      })
  }, [slug])

  if (!loaded) {
    return <div className="flex justify-center py-24"><Spinner size="lg" /></div>
  }

  if (!entry) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EmptyState
          icon={Compass}
          message="This showcase page doesn't exist."
          action={<Link to="/outcomes"><Button>See the Outcomes Board</Button></Link>}
        />
      </div>
    )
  }

  const embed = embedUrl(entry.video_url)
  const title = `${entry.display_name} built a ${typeLabel(entry.project_type)} for ${entry.business_name}`

  return (
    <>
      <Seo
        title={`${entry.display_name} — ${typeLabel(entry.project_type)}`}
        description={entry.headline ?? title}
        path={`/outcomes/${entry.slug}`}
      />
      <article className="mx-auto max-w-3xl px-4 py-12">
        <Link to="/outcomes" className="text-sm font-medium text-svgblue-500 hover:text-svgblue-700">← All outcomes</Link>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <DeployedBadge />
          <Badge variant="blue">{typeLabel(entry.project_type)}</Badge>
        </div>
        <h1 className="mt-3 font-heading text-3xl font-bold text-ink md:text-4xl">{entry.display_name}</h1>
        <p className="mt-1 text-lg text-ink-muted">Built for {entry.business_name}, {entry.island}</p>
        {entry.headline && <p className="mt-4 text-xl text-ink">{entry.headline}</p>}

        {embed ? (
          <div className="mt-8 overflow-hidden rounded-xl">
            <iframe
              src={embed}
              title="Project walkthrough"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="aspect-video w-full"
            />
          </div>
        ) : entry.video_url ? (
          <div className="mt-8">
            <a href={entry.video_url} target="_blank" rel="noopener noreferrer">
              <Button>Watch the walkthrough</Button>
            </a>
          </div>
        ) : null}

        {photoUrl(entry.photo_path) && (
          <img src={photoUrl(entry.photo_path)!} alt="" className="mt-8 w-full rounded-xl" />
        )}

        {entry.narrative && (
          <div className="mt-8">
            <Markdown source={entry.narrative} />
          </div>
        )}
      </article>

      {/* CTA band */}
      <section className="bg-gradient-to-r from-svgblue-500 to-svggreen-500">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-12 sm:flex-row sm:items-center">
          <div>
            <p className="font-heading text-xl font-semibold text-white">Want to build things like this?</p>
            <p className="text-base text-white/90">Applications are open.</p>
          </div>
          <div className="flex gap-3">
            <Link to="/apply"><Button variant="secondary" className="border-white bg-white">Apply</Button></Link>
            <Link to="/businesses"><Button variant="secondary" className="border-white bg-transparent text-white hover:bg-white/10">Get one built</Button></Link>
          </div>
        </div>
      </section>
    </>
  )
}
