import { describe, expect, it } from 'vitest';
import { RULES_BY_LANG } from '../loadRules';
import { renderInlineMarkdown, renderMarkdown } from '../renderMarkdown';

describe('renderInlineMarkdown', () => {
  it('escapes HTML then applies bold and italic', () => {
    expect(renderInlineMarkdown('**Moles** win')).toBe('<strong>Moles</strong> win');
    expect(renderInlineMarkdown('*Exception:* note')).toBe('<em>Exception:</em> note');
    expect(renderInlineMarkdown('<script>x</script>')).toBe(
      '&lt;script&gt;x&lt;/script&gt;',
    );
  });

  it('keeps escaped asterisks as literal stars', () => {
    expect(renderInlineMarkdown('\\* - footnote')).toBe('&#42; - footnote');
  });
});

describe('renderMarkdown', () => {
  it('renders headings, nested lists, and the sabotage footnote', () => {
    const html = renderMarkdown(RULES_BY_LANG.en);
    expect(html).toContain('<h1>Police Raid</h1>');
    expect(html).toContain('<h2>Story</h2>');
    expect(html).toContain('<h3>Round Phases</h3>');
    expect(html).toContain('<ol>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<strong>Discussion:</strong>');
    expect(html).toContain('<em>Exception:</em>');
    expect(html).toContain('&#42; - the raid can only be won');
    expect(html).not.toContain('<script');
  });

  it('renders the Russian rules file', () => {
    const html = renderMarkdown(RULES_BY_LANG.ru);
    expect(html).toContain('<h2>Сюжет</h2>');
    expect(html).toContain('<strong>Обсуждение:</strong>');
    expect(html).toContain('Лимит отказов');
  });
});
