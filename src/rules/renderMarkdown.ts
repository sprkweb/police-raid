function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Inline markdown: escaped asterisks, bold, italic. HTML is escaped first. */
export function renderInlineMarkdown(text: string): string {
  const escaped = escapeHtml(text).replace(/\\\*/g, '&#42;');
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function indentWidth(ws: string): number {
  return ws.replace(/\t/g, '    ').length;
}

type ListKind = 'ul' | 'ol';

function listMarker(line: string): { indent: number; kind: ListKind; rest: string } | null {
  const match = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line);
  if (!match) return null;
  const kind: ListKind = match[2] === '-' || match[2] === '*' ? 'ul' : 'ol';
  return { indent: indentWidth(match[1]), kind, rest: match[3] };
}

function parseList(lines: string[], start: number, minIndent: number): { html: string; next: number } {
  const first = listMarker(lines[start]);
  if (!first) return { html: '', next: start };

  const kind = first.kind;
  const items: string[] = [];
  let i = start;

  while (i < lines.length) {
    const marker = listMarker(lines[i]);
    if (!marker || marker.indent < minIndent) break;
    if (marker.indent > minIndent) {
      const nested = parseList(lines, i, marker.indent);
      if (items.length === 0) {
        items.push(`<li>${nested.html}</li>`);
      } else {
        items[items.length - 1] = items[items.length - 1].replace(/<\/li>$/, `${nested.html}</li>`);
      }
      i = nested.next;
      continue;
    }
    if (marker.kind !== kind) break;

    let body = renderInlineMarkdown(marker.rest);
    i += 1;
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === '') break;
      if (listMarker(line)) break;
      const continued = /^(\s+)(.+)$/.exec(line);
      if (!continued || indentWidth(continued[1]) <= minIndent) break;
      body += ` ${renderInlineMarkdown(continued[2])}`;
      i += 1;
    }
    items.push(`<li>${body}</li>`);
  }

  return { html: `<${kind}>${items.join('')}</${kind}>`, next: i };
}

/** Trusted static rules markdown → HTML. Unknown HTML in the source is escaped. */
export function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  const paragraph: string[] = [];
  let i = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    html.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph.length = 0;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      flushParagraph();
      i += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (listMarker(line)) {
      flushParagraph();
      const list = parseList(lines, i, listMarker(line)!.indent);
      html.push(list.html);
      i = list.next;
      continue;
    }

    paragraph.push(line.trim());
    i += 1;
  }

  flushParagraph();
  return html.join('\n');
}
