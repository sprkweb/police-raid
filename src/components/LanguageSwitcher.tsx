import React from 'react';
import { useTranslation } from 'react-i18next';

export const LanguageSwitcher: React.FC = () => {
  const { t, i18n } = useTranslation();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
  };

  const lang = i18n.language.split('-')[0] === 'ru' ? 'ru' : 'en';

  return (
    <label className="pr-tool pr-lang">
      <span className="pr-lang-code" aria-hidden="true">
        {lang.toUpperCase()}
      </span>
      <span className="material-icons pr-lang-chevron" aria-hidden="true">
        expand_more
      </span>
      <select
        value={lang}
        onChange={handleLanguageChange}
        aria-label={t('app.language')}
        className="pr-lang-select"
      >
        <option value="en">EN</option>
        <option value="ru">RU</option>
      </select>
    </label>
  );
};
