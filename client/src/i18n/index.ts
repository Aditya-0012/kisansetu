import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en/translation.json";
import hi from "./locales/hi/translation.json";
import mr from "./locales/mr/translation.json";

const STORAGE_KEY = "kisansetu.language";

function getInitialLanguage(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // ignore — fall through to browser default
  }
  const nav = typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : "en";
  return ["en", "hi", "mr"].includes(nav) ? nav : "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    mr: { translation: mr },
  },
  lng: getInitialLanguage(),
  fallbackLng: "en", // Hindi/Marathi are partial — English fills any gaps.
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

export function changeLanguage(lang: "en" | "hi" | "mr") {
  i18n.changeLanguage(lang);
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // non-fatal
  }
  document.documentElement.lang = lang;
}

export default i18n;
