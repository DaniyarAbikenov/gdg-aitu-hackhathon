import i18n, { type BackendModule, type ResourceKey } from "i18next";
import { initReactI18next } from "react-i18next";

// Each language is its own chunk, downloaded only when it is used.
const locales = import.meta.glob<{ default: ResourceKey }>("./locales/*.json");
const lazyLocales: BackendModule = {
  type: "backend",
  init: () => {},
  read: (language, _namespace, done) => {
    const load = locales[`./locales/${language}.json`];
    if (!load) return done(new Error(`No translations for ${language}`), null);
    load().then(
      (module) => done(null, module.default),
      (error) => done(error, null),
    );
  },
};

const storedLanguage = localStorage.getItem("language");
const initialLanguage =
  storedLanguage === "kk"
    ? "kz"
    : ["ru", "en", "kz"].includes(storedLanguage || "")
      ? storedLanguage!
      : "ru";

/** Resolves once the first language is loaded; render after it so no raw keys flash. */
export const i18nReady = i18n
  .use(lazyLocales)
  .use(initReactI18next)
  .init({
    lng: initialLanguage,
    supportedLngs: ["ru", "en", "kz"],
    // scripts/check_locales.cjs keeps every language complete, so no fallback is downloaded.
    fallbackLng: false,
    react: { useSuspense: false },
    interpolation: {
      escapeValue: false,
    },
  });

const setDocumentLanguage = (language: string) => {
  document.documentElement.lang = language === "kz" ? "kk" : language;
};
setDocumentLanguage(i18n.language || "ru");
i18n.on("languageChanged", setDocumentLanguage);

export default i18n;
