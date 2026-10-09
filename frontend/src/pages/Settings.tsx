import { tr, useLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logout } from "@/api/auth";
import { useAuthStore } from "@/store/auth";
import client from "@/api/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { AccountControls } from "@/components/AccountControls";
export default function Settings() {
  useLocale();
  const [passwordAccount, setPasswordAccount] = useState(false);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [admin, setAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    client
      .get("/capabilities")
      .then((r) => {
        setAdmin(r.data.admin);
        setPasswordAccount(r.data.password_account);
      })
      .catch((e) => setError(e.message));
  }, []);
  const signout = async () => {
    setBusy(true);
    try {
      await logout();
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
        </div>
      </div>
    </MainLayout>
  );
}
