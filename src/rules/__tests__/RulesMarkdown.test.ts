import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RULES_BY_LANG } from '../loadRules';
import { RulesMarkdown } from '../RulesMarkdown';

function render(source: string): string {
  return renderToStaticMarkup(createElement(RulesMarkdown, { source }));
}

describe('RulesMarkdown', () => {
  it('renders headings, nested lists, and emphasis from the English rules', () => {
    const html = render(RULES_BY_LANG.en);
    expect(html).toContain('<h1>Police Raid</h1>');
    expect(html).toContain('<h2>Story</h2>');
    expect(html).toContain('<h3>Round Phases</h3>');
    expect(html).toContain('<ol>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<strong>Discussion:</strong>');
    expect(html).toContain('<em>Exception:</em>');
    expect(html).toContain('* - the raid can only be won');
    expect(html).not.toContain('<script');
  });

  it('renders the Russian rules file', () => {
    const html = render(RULES_BY_LANG.ru);
    expect(html).toContain('<h2>Сюжет</h2>');
    expect(html).toContain('<strong>Обсуждение:</strong>');
    expect(html).toContain('Лимит отказов');
  });

  it('does not turn raw HTML in markdown into elements', () => {
    const html = render('**Moles** win\n\n<script>x</script>');
    expect(html).toContain('<strong>Moles</strong> win');
    expect(html).not.toMatch(/<script[\s>]/i);
  });
});
