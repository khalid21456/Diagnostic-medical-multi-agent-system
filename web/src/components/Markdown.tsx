import type { ReactNode } from 'react'

/**
 * Minimal Markdown renderer for report text (headings, lists, paragraphs,
 * **bold**, *italic*, `code`). Builds React elements — never injects HTML,
 * so model output can't execute scripts. Swap for `react-markdown` if the
 * reports need tables or links.
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let last = 0
  let i = 0
  for (const match of text.matchAll(pattern)) {
    const idx = match.index ?? 0
    if (idx > last) nodes.push(text.slice(last, idx))
    const token = match[0]
    const key = `${keyPrefix}-${i++}`
    if (token.startsWith('**')) nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    else if (token.startsWith('`')) nodes.push(<code key={key}>{token.slice(1, -1)}</code>)
    else nodes.push(<em key={key}>{token.slice(1, -1)}</em>)
    last = idx + token.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'p'; text: string }

function parse(markdown: string): Block[] {
  const blocks: Block[] = []
  let paragraph: string[] = []

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: 'p', text: paragraph.join(' ') })
    paragraph = []
  }

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim()
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    const ul = /^[-*+]\s+(.*)$/.exec(line)
    const ol = /^\d+[.)]\s+(.*)$/.exec(line)

    if (!line) {
      flushParagraph()
    } else if (heading) {
      flushParagraph()
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] })
    } else if (ul || ol) {
      flushParagraph()
      const kind = ul ? 'ul' : 'ol'
      const item = (ul ?? ol)![1]
      const prev = blocks.at(-1)
      if (prev && prev.kind === kind) prev.items.push(item)
      else blocks.push({ kind, items: [item] })
    } else {
      paragraph.push(line)
    }
  }
  flushParagraph()
  return blocks
}

export function Markdown({ source }: { source: string }) {
  return (
    <div className="markdown">
      {parse(source).map((block, i) => {
        const key = `b${i}`
        switch (block.kind) {
          case 'heading': {
            // Report sections start at h3: the page already owns h1/h2.
            const level = Math.min(block.level + 2, 6)
            const Tag = `h${level}` as 'h3' | 'h4' | 'h5' | 'h6'
            return <Tag key={key}>{renderInline(block.text, key)}</Tag>
          }
          case 'ul':
          case 'ol': {
            const List = block.kind
            return (
              <List key={key}>
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item, `${key}-${j}`)}</li>
                ))}
              </List>
            )
          }
          case 'p':
            return <p key={key}>{renderInline(block.text, key)}</p>
        }
      })}
    </div>
  )
}
