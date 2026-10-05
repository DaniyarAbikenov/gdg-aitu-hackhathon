import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ru from "./locales/ru.json";
import en from "./locales/en.json";
import kz from "./locales/kz.json";

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    en: { translation: en },
    kz: { translation: kz },
  },
  lng: localStorage.getItem("language") || "ru",
  fallbackLng: "ru",
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
