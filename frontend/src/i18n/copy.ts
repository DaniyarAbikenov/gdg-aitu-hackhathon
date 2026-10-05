import { useTranslation } from "react-i18next";
import i18n from "./config";
export const tr = (key: string, values?: Record<string, unknown>) =>
  i18n.t(key, values);
/** Subscribe a screen to language changes without remounting or losing its draft. */
export function useLocale() {
  return useTranslation();
}

export const displayLocale = () =>
  i18n.language === "kz" ? "kk-KZ" : i18n.language === "ru" ? "ru-RU" : "en-GB";
