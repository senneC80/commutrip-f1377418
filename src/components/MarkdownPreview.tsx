// Tiny markdown renderer — no extra deps. Supports headings (#, ##, ###),
// bold (**text**), italic (*text*), and basic paragraphs / line breaks.
// For richer formatting we can swap in react-markdown later.

import { useMemo } from 'react';

export default function MarkdownPreview({ content, className }: { content: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(content), [content]);
  return <div className={`prose prose-sm max-w-none text-foreground ${className || ''}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
}

function renderInline(s: string): string {
  let out = escapeHtml(s);
  // bold
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // italic
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return out;
}

function renderMarkdown(content: string): string {
  const lines = content.split(/\r?\n/);
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (listItems.length) {
      blocks.push(`<ul>${listItems.map(i => `<li>${renderInline(i)}</li>`).join('')}</ul>`);
      listItems = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushParagraph(); flushList(); continue; }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flushParagraph(); flushList();
      const level = h[1].length;
      blocks.push(`<h${level}>${renderInline(h[2])}</h${level}>`);
      continue;
    }
    const li = /^[-*]\s+(.*)$/.exec(line);
    if (li) { flushParagraph(); listItems.push(li[1]); continue; }
    flushList();
    paragraph.push(line);
  }
  flushParagraph(); flushList();
  return blocks.join('\n');
}
