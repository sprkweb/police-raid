import React from 'react';
import { useTranslation } from 'react-i18next';

export const LanguageSwitcher: React.FC = () => {
  const { t, i18n } = useTranslation();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
  };

  return (
    <label className="pr-stat pr-lang">
      <span className="pr-stat-k">{t('app.language')}</span>
      <select
        value={i18n.language.split('-')[0]} // Handle e.g., 'en-US' by getting 'en'
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
