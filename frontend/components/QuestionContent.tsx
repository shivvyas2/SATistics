'use client'

import { useMemo } from 'react'

const ALLOWED_TAGS = new Set([
  'p', 'br', 'span', 'div', 'b', 'strong', 'i', 'em', 'u', 'sup', 'sub',
  'ul', 'ol', 'li', 'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption',
  'math', 'mrow', 'mi', 'mn', 'mo', 'mtext', 'mspace', 'mfrac', 'msqrt', 'mroot',
  'msup', 'msub', 'msubsup', 'munder', 'mover', 'munderover',
  'mtable', 'mtr', 'mtd', 'mstyle', 'mpadded', 'mphantom', 'menclose',
])
const ALLOWED_ATTRS = new Set(['alttext', 'display', 'mathvariant', 'colspan', 'rowspan', 'columnalign', 'linethickness'])

// The backend already sanitizes question HTML; this is a second check before it reaches the DOM
function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const clean = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (!ALLOWED_TAGS.has(child.tagName.toLowerCase())) {
        child.remove()
        continue
      }
      for (const attr of Array.from(child.attributes)) {
        if (!ALLOWED_ATTRS.has(attr.name.toLowerCase())) child.removeAttribute(attr.name)
      }
      clean(child)
    }
  }
  clean(doc.body)
  return doc.body.innerHTML
}

interface QuestionContentProps {
  // Sanitized HTML/MathML, when the question has it
  html?: string
  text: string
  className?: string
}

/**
 * Renders question text, with math and formatting when the source provides it
 */
export function QuestionContent({ html, text, className = '' }: QuestionContentProps) {
  const safeHtml = useMemo(() => (html ? sanitize(html) : null), [html])

  if (safeHtml) {
    return <div className={`question-content ${className}`} dangerouslySetInnerHTML={{ __html: safeHtml }} />
  }
  return <div className={`question-content whitespace-pre-line ${className}`}>{text}</div>
}
