import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../engine/constants';
import { getRulesMarkdown, resolveRulesLang, RULES_BY_LANG } from '../loadRules';

describe('resolveRulesLang', () => {
  it('maps Russian locales to ru and everything else to en', () => {
    expect(resolveRulesLang('ru')).toBe('ru');
    expect(resolveRulesLang('ru-RU')).toBe('ru');
    expect(resolveRulesLang('en')).toBe('en');
    expect(resolveRulesLang('en-US')).toBe('en');
    expect(resolveRulesLang('de')).toBe('en');
    expect(resolveRulesLang('')).toBe('en');
  });
});

describe('getRulesMarkdown', () => {
  it('loads the bundled markdown files rather than duplicating the text', () => {
    expect(getRulesMarkdown('en')).toBe(RULES_BY_LANG.en);
    expect(getRulesMarkdown('ru-RU')).toBe(RULES_BY_LANG.ru);
    expect(RULES_BY_LANG.en).toContain('## Mechanics');
    expect(RULES_BY_LANG.ru).toContain('## Механика');
  });

  it('documents the same team sizes as the engine balance table', () => {
    const sizes = (n: 5 | 6 | 7 | 8) => BALANCE[n].teamSizes.join('-');
    for (const md of [RULES_BY_LANG.en, RULES_BY_LANG.ru]) {
      expect(md).toContain(`5`);
      expect(md).toContain(sizes(5));
      expect(md).toContain(sizes(6));
      expect(md).toContain('2-3-3-4*-4');
      expect(md).toContain('3-4-4-5*-5');
    }
  });
});
