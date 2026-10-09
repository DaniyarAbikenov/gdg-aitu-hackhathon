import { tr, useLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLogout } from "@/features/auth/api";
import { useAuthStore } from "@/features/auth/store";
import { useCapabilitiesQuery } from "@/api/system";
import { MainLayout } from "@/components/layout/MainLayout";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { AccountControls } from "@/features/auth/components/AccountControls";
import { EmailVerification } from "@/features/auth/components/EmailVerification";
export default function Settings() {
  useLocale();
  const capabilities = useCapabilitiesQuery();
  const passwordAccount = capabilities.data?.password_account ?? false;
  const admin = capabilities.data?.admin ?? false;
  const logout = useLogout();
  const navigate = useNavigate();
  const [signoutError, setError] = useState("");
  const error =
    signoutError ||
    (capabilities.error ? getErrorMessage(capabilities.error) : "");
  const [busy, setBusy] = useState(false);
  const signout = async () => {
    setBusy(true);
    try {
      await logout.mutateAsync();
      navigate("/login");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <MainLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">{tr("copy.c484")}</h1>
        {error && <p role="alert">{error}</p>}
        <section className="border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold">{tr("copy.c485")}</h2>
          <LanguageSwitcher />
        </section>
        <section className="border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold">{tr("copy.c486")}</h2>
          <p>{useAuthStore.getState().email}</p>
          <EmailVerification />
          <Button disabled={busy} variant="outline" onClick={signout}>
            {tr("ui.logout")}
          </Button>
        </section>
        <AccountControls passwordAccount={passwordAccount} />
        <div className="flex flex-wrap gap-4">
          <Link className="text-primary underline" to="/onboarding">
            {tr("copy.c487")}
          </Link>
          <Link className="text-primary underline" to="/legal/policies">
            {tr("copy.c488")}
          </Link>
          {admin && (
            <Link className="text-primary underline" to="/admin/knowledge">
              {tr("copy.c351")}
            </Link>
          )}
          {admin && (
            <Link className="text-primary underline" to="/admin/ai-usage">
              {tr("usage.title")}
            </Link>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
