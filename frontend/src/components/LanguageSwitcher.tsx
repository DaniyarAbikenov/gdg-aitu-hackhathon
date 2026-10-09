import { updateUserProfile } from "@/api/user";
import { getErrorMessage } from "@/lib/errors";
import { useAuthStore } from "@/store/auth";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Languages } from "lucide-react";

const languages = [
  { code: "ru", name: "Русский" },
  { code: "en", name: "English" },
  { code: "kz", name: "Қазақша" },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const changeLanguage = async (lng: string) => {
    if (useAuthStore.getState().isAuthenticated) {
      try {
        const profile = await updateUserProfile({
          language: lng === "kz" ? "kk" : lng,
        });
        window.dispatchEvent(
          new CustomEvent("profile-language-saved", {
            detail: profile.revision,
          }),
        );
      } catch (e) {
        toast({ title: getErrorMessage(e), variant: "destructive" });
        return;
      }
    }
    i18n.changeLanguage(lng);
    localStorage.setItem("language", lng);
  };

  const currentLanguage = languages.find((lang) => lang.code === i18n.language);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Languages className="h-4 w-4" />
          <span>{currentLanguage?.name || "Язык"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={i18n.language === lang.code ? "bg-accent" : ""}
          >
            {lang.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
