import { Link } from 'react-router-dom'

const FOOTER_LINKS = [
  { to: '/program', label: 'Program' },
  { to: '/businesses', label: 'For Businesses' },
  { to: '/about', label: 'About' },
  { to: '/faq', label: 'FAQ' },
  { to: '/signin', label: 'Sign In' },
]

export function Footer() {
  return (
    <footer className="border-t border-line bg-svgblue-50 print:hidden">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-12 md:grid-cols-3">
        {/* Wordmark + mission + flag bars */}
        <div className="flex flex-col gap-3">
          <span className="font-heading text-xl font-bold text-svgblue-500">SVG AI Institute</span>
          <p className="text-sm text-ink-muted">
            Training Vincentian youth to build real AI systems for real businesses — free.
          </p>
          <div className="w-24" aria-hidden="true">
            <div className="h-1 bg-svgblue-500" />
            <div className="h-1 bg-svggold-500" />
            <div className="h-1 bg-svggreen-500" />
          </div>
        </div>

        {/* Links */}
        <nav className="flex flex-col gap-2" aria-label="Footer">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-sm font-medium text-ink hover:text-svgblue-500"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Contact */}
        <div className="flex flex-col gap-2 text-sm text-ink-muted">
          <a href="mailto:hello@svgai.institute" className="font-medium text-svgblue-500 hover:text-svgblue-700">
            hello@svgai.institute
          </a>
          <p>Kingstown, Saint Vincent and the Grenadines</p>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-4 text-sm text-ink-muted">
          © {new Date().getFullYear()} SVG AI Institute
        </p>
      </div>
    </footer>
  )
}
