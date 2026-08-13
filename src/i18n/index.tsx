import { getLocales } from 'expo-localization';
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { store } from '@/database/store';
import { english, translations, type TranslationKey } from '@/i18n/translations';
import type { AppLanguage } from '@/types';

type ResolvedLanguage = Exclude<AppLanguage, 'system'>;
type Params = Record<string, string | number>;

const resolveSystemLanguage = (): ResolvedLanguage => {
  const code = getLocales()[0]?.languageCode?.toLowerCase();
  if (code === 'fil' || code === 'tl') return 'fil';
  if (code === 'ceb') return 'ceb';
  return 'en';
};

const render = (value: string, params?: Params) => Object.entries(params ?? {}).reduce(
  (message, [key, replacement]) => message.replaceAll(`{{${key}}}`, String(replacement)),
  value,
);

export const translate = (key: TranslationKey, language: ResolvedLanguage, params?: Params) => render(translations[language][key] ?? english[key], params);

type I18nValue = {
  preference: AppLanguage;
  language: ResolvedLanguage;
  locale: string;
  t: (key: TranslationKey, params?: Params) => string;
  tr: (value: string) => string;
  formatLongDate: (date: Date) => string;
  setLanguage: (language: AppLanguage) => Promise<void>;
};

const cebuanoWeekdays = ['Domingo', 'Lunes', 'Martes', 'Miyerkules', 'Huwebes', 'Biyernes', 'Sabado'];
const cebuanoMonths = ['Enero', 'Pebrero', 'Marso', 'Abril', 'Mayo', 'Hunyo', 'Hulyo', 'Agosto', 'Septiyembre', 'Oktubre', 'Nobyembre', 'Disyembre'];

const longDate = (date: Date, language: ResolvedLanguage, locale: string) => language === 'ceb'
  ? `${cebuanoWeekdays[date.getDay()]}, ${cebuanoMonths[date.getMonth()]} ${date.getDate()}`
  : new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(date);

const I18nContext = createContext<I18nValue>({
  preference: 'system', language: 'en', locale: 'en-PH', t: (key, params) => render(english[key], params), tr: (value) => value, formatLongDate: (date) => longDate(date, 'en', 'en-PH'), setLanguage: async () => undefined,
});

const literalKeys = new Map<string, TranslationKey>(Object.entries(english).map(([key, value]) => [value, key as TranslationKey]));

export const LanguageProvider = ({ children }: PropsWithChildren) => {
  const [state, setState] = useState({ preference: 'system' as AppLanguage });

  useEffect(() => {
    store.getSetting('app_language').then((saved) => {
      if (saved === 'system' || saved === 'en' || saved === 'fil' || saved === 'ceb') setState({ preference: saved });
    });
  }, []);

  const value = useMemo<I18nValue>(() => {
    const language = state.preference === 'system' ? resolveSystemLanguage() : state.preference;
    const locale = language === 'fil' ? 'fil-PH' : language === 'ceb' ? 'ceb-PH' : 'en-PH';
    return {
      preference: state.preference,
      language,
      locale,
      t: (key, params) => translate(key, language, params),
      tr: (text) => {
        const key = literalKeys.get(text);
        return key ? translate(key, language) : text;
      },
      formatLongDate: (date) => longDate(date, language, locale),
      setLanguage: async (preference) => {
        await store.setSetting('app_language', preference);
        setState({ preference });
      },
    };
  }, [state.preference]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);
