import { tr, useLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { Mic } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import i18n from "@/i18n/config";
interface Recognition {
  lang: string;
  interimResults: boolean;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
export function DictationButton({
  onText,
  disabled,
}: {
  onText: (value: string) => void;
  disabled: boolean;
}) {
  useLocale();
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const current = useRef<Recognition | null>(null);
  const browser = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  const Factory = browser.SpeechRecognition || browser.webkitSpeechRecognition;
  useEffect(() => {
    return () => current.current?.stop();
  }, []);
  const toggle = () => {
    if (active) {
      current.current?.stop();
      return;
    }
    if (!Factory) return;
    const recognition = new Factory();
    current.current = recognition;
    recognition.lang =
      { en: "en-US", ru: "ru-RU", kz: "kk-KZ" }[i18n.language] || "en-US";
    recognition.interimResults = false;
    recognition.onresult = (e) =>
      onText(
        Array.from(e.results)
          .map((r) => r[0].transcript)
          .join(" "),
      );
    recognition.onerror = (e) => {
      setError(e.error);
      setActive(false);
    };
    recognition.onend = () => setActive(false);
    try {
      recognition.start();
      setActive(true);
      setError("");
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };
  return (
    <div className="space-y-2 text-sm">
      <p className="text-muted-foreground">{tr("copy.c024")}</p>
      <Button
        variant="outline"
        disabled={disabled || !Factory}
        onClick={toggle}
      >
        <Mic className="h-4 w-4 mr-2" aria-hidden="true" />
        {!Factory
          ? tr("copy.c025")
          : active
            ? tr("copy.c026")
            : tr("copy.c027")}
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
