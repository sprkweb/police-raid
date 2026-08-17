import rulesEn from '../../RULES.en.md?raw';
import rulesRu from '../../RULES.ru.md?raw';

export const RULES_BY_LANG = {
  en: rulesEn,
  ru: rulesRu,
} as const;

export type RulesLang = keyof typeof RULES_BY_LANG;

export function resolveRulesLang(language: string): RulesLang {
  const base = language.split('-')[0]?.toLowerCase() ?? 'en';
  return base === 'ru' ? 'ru' : 'en';
}

export function getRulesMarkdown(language: string): string {
  return RULES_BY_LANG[resolveRulesLang(language)];
}
