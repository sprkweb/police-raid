import React from 'react';
import { useTranslation } from 'react-i18next';

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
  };

  return (
    <select
      value={i18n.language.split('-')[0]} // Handle e.g., 'en-US' by getting 'en'
      onChange={handleLanguageChange}
      aria-label="Select language"
      className="pr-lang"
    >
      <option value="en">EN</option>
      <option value="ru">RU</option>
    </select>
  );
};
