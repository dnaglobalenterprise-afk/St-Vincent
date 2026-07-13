export function Footer() {
  return (
    <footer className="bg-svgblue-50">
      <div aria-hidden="true">
        <div className="h-1 bg-svgblue-500" />
        <div className="h-1 bg-svggold-500" />
        <div className="h-1 bg-svggreen-500" />
      </div>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
        <p className="text-sm text-ink-muted">
          © {new Date().getFullYear()} Saint Vincent AI &amp; Innovation Institute
        </p>
        <p className="font-heading text-sm font-semibold text-svgblue-500">SVG AI Institute</p>
      </div>
    </footer>
  )
}
