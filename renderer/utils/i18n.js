import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector'; 

import tr from '../locales/tr.json';
import en from '../locales/en.json';
import es from '../locales/es.json';
import de from '../locales/de.json';
import fr from '../locales/fr.json';
import ru from '../locales/ru.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      tr: { translation: tr },
      en: { translation: en },
      es: { translation: es },
      de: { translation: de },
      fr: { translation: fr },
      ru: { translation: ru }
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;