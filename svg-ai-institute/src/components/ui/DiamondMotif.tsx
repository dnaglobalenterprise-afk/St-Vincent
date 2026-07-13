interface DiamondMotifProps {
  /** Width of the motif in pixels; height scales proportionally. */
  size?: number
  /** Opacity of the pattern, 0-1. Keep low (0.08-0.12) — this is a background element. */
  opacity?: number
  className?: string
}

/**
 * The V-diamond brand motif from the SVG flag: three green diamonds arranged
 * in a V. Rendered as a decorative, absolutely-positioned background element.
 */
export function DiamondMotif({ size = 240, opacity = 0.1, className = '' }: DiamondMotifProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size * 0.75}
      viewBox="0 0 160 120"
      className={`pointer-events-none absolute text-svggreen-500 ${className}`}
      style={{ opacity }}
    >
      <rect x="24" y="20" width="34" height="34" fill="currentColor" transform="rotate(45 41 37)" />
      <rect x="102" y="20" width="34" height="34" fill="currentColor" transform="rotate(45 119 37)" />
      <rect x="63" y="62" width="34" height="34" fill="currentColor" transform="rotate(45 80 79)" />
    </svg>
  )
}
