import ReactMarkdown from 'react-markdown'

/** Markdown rendering with the platform's typographic styles. */
export function Markdown({ source }: { source: string }) {
  return (
    <div className="max-w-none">
      <ReactMarkdown
        components={{
          h1: (props) => <h1 className="mb-4 mt-6 font-heading text-3xl font-bold text-ink" {...props} />,
          h2: (props) => <h2 className="mb-3 mt-6 font-heading text-2xl font-semibold text-ink" {...props} />,
          h3: (props) => <h3 className="mb-2 mt-5 font-heading text-xl font-semibold text-ink" {...props} />,
          p: (props) => <p className="mb-4 text-base text-ink" {...props} />,
          ul: (props) => <ul className="mb-4 list-disc pl-6 text-base text-ink" {...props} />,
          ol: (props) => <ol className="mb-4 list-decimal pl-6 text-base text-ink" {...props} />,
          li: (props) => <li className="mb-1" {...props} />,
          a: (props) => (
            <a className="font-medium text-svgblue-500 underline hover:text-svgblue-700" {...props} />
          ),
          blockquote: (props) => (
            <blockquote className="mb-4 border-l-4 border-svggold-500 pl-4 italic text-ink-muted" {...props} />
          ),
          code: (props) => {
            const { className, children } = props
            const isBlock = className?.includes('language-') || String(children).includes('\n')
            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-xl bg-surface-alt p-4 text-sm text-ink">
                  {children}
                </code>
              )
            }
            return <code className="rounded bg-surface-alt px-1.5 py-0.5 text-sm text-ink">{children}</code>
          },
          pre: (props) => <pre className="mb-4" {...props} />,
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}
