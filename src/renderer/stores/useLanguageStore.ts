import { create } from 'zustand';
import { LanguageCode, TextDirection } from '@shared/types';
import enTranslations from '../translations/en.json';
import arTranslations from '../translations/ar.json';

type Dictionary = Record<string, string>;

const dictionaries: Record<string, Dictionary> = {
  en: enTranslations,
  ar: arTranslations,
};

interface LanguageState {
  language: LanguageCode;
  direction: TextDirection;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string) => string;
}

const getInitialLanguage = (): LanguageCode => {
  try {
    const saved = localStorage.getItem('gamma_language') as string | null;
    if (saved === 'ar') {
      return 'ar';
    }
    if (saved === 'en') {
      return 'en';
    }
  } catch {
    // fallback
  }
  return 'en'; // Default to English
};

const initialLang = getInitialLanguage();
const initialDir: TextDirection = initialLang === 'ar' ? 'rtl' : 'ltr';
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('dir', initialDir);
  document.documentElement.setAttribute('lang', initialLang);
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  language: initialLang,
  direction: initialDir,
  setLanguage: (lang: LanguageCode) => {
    const safeLang: LanguageCode = lang === 'ar' ? 'ar' : 'en';
    const dir: TextDirection = safeLang === 'ar' ? 'rtl' : 'ltr';
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('dir', dir);
      document.documentElement.setAttribute('lang', safeLang);
    }
    try {
      localStorage.setItem('gamma_language', safeLang);
    } catch {
      // ignore
    }
    set({ language: safeLang, direction: dir });
  },
  t: (key: string) => {
    const lang = get().language;
    const dict = dictionaries[lang] || dictionaries.en;
    return dict[key] || key;
  },
}));
