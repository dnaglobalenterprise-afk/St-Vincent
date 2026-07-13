import { Helmet } from 'react-helmet-async'
import { SITE_NAME, SITE_URL } from '../../lib/site'

interface SeoProps {
  /** Page title without the site suffix; pass null for the home page's full custom title. */
  title: string | null
  description: string
  path: string
}

export function Seo({ title, description, path }: SeoProps) {
  const fullTitle = title
    ? `${title} — ${SITE_NAME}`
    : 'SVG AI Institute — Free AI & Automation School for Vincentian Youth'
  const url = SITE_URL + path

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${SITE_URL}/og-image.png`} />
    </Helmet>
  )
}
