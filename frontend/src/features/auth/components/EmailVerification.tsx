import { tr, useLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { useAuthOptions, useSendVerification } from "../api";
import { useAuthStore } from "../store";

/** Confirmation status in settings, with a way to request a new link. */
export function EmailVerification() {
  useLocale();
  const verified = useAuthStore((s) => s.emailVerified);
  const mail = useAuthOptions().data?.email ?? false;
  const send = useSendVerification();
  if (verified) return <p className="text-sm">{tr("verify.confirmed")}</p>;
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {tr("verify.notConfirmed")}
      </p>
      {mail &&
        (send.isSuccess ? (
          <p role="status" className="text-sm">
            {tr("verify.sent")}
          </p>
        ) : (
          <Button
            variant="outline"
            disabled={send.isPending}
            onClick={() => send.mutate()}
          >
            {tr("verify.send")}
          </Button>
        ))}
      {send.error && (
        <p role="alert" className="text-destructive">
          {getErrorMessage(send.error)}
        </p>
      )}
    </div>
  );
}
