import { useEffect, useState } from 'react';
import { I18nContext } from './context.js';
import en from './en.js';
import ur from './ur.js';

const translations = { en, ur };

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('ff_lang') || 'en');

  useEffect(() => {
    localStorage.setItem('ff_lang', lang);
    document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'en' ? 'ur' : 'en'));
  };

  const t = (key, params = {}) => {
    const dict = translations[lang] || translations.en;
    let text = dict[key] || translations.en[key] || key;

    Object.entries(params).forEach(([paramKey, paramVal]) => {
      text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), paramVal);
    });

    return text;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, toggleLanguage, t, isRtl: lang === 'ur' }}>
      {children}
    </I18nContext.Provider>
  );
}
