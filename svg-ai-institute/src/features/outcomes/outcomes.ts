import { CAPSTONE_TYPE_LABELS } from '../capstone/capstone'
import type { CapstoneType } from '../../lib/types'

export const typeLabel = (t: CapstoneType | null): string => (t ? CAPSTONE_TYPE_LABELS[t] : 'Project')

/** Only the denormalized public fields — never project_id, published_by, or consent internals. */
export const PUBLIC_SHOWCASE_COLUMNS =
  'id, slug, headline, narrative, photo_path, display_name, project_type, business_name, island, video_url, published_at'

/** Turn a YouTube/Loom URL into an embeddable iframe src, or null if not embeddable. */
export function embedUrl(url: string | null): string | null {
  if (!url) return null
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const loom = url.match(/loom\.com\/(?:share|embed)\/([\w]+)/)
  if (loom) return `https://www.loom.com/embed/${loom[1]}`
  return null
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export const WA_SHARE = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`

import { SITE_URL } from '../../lib/site'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

/** Public URL for a showcase photo stored in the public `showcase` bucket. */
export function photoUrl(path: string | null): string | null {
  return path ? `${SUPABASE_URL}/storage/v1/object/public/showcase/${path}` : null
}

export const showcaseUrl = (slug: string) => `${SITE_URL}/outcomes/${slug}`
