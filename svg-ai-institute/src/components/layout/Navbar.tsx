import { Link } from 'react-router-dom'

export function Navbar() {
  return (
    <header className="border-b border-line bg-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/" className="font-heading text-xl font-bold text-svgblue-500">
          SVG AI Institute
        </Link>
        <div className="flex items-center gap-6">
          <Link to="/" className="text-base font-medium text-ink hover:text-svgblue-500">
            Home
          </Link>
          <Link to="/signin" className="text-base font-medium text-svgblue-500 hover:text-svgblue-700">
            Sign In
          </Link>
        </div>
      </nav>
    </header>
  )
}
