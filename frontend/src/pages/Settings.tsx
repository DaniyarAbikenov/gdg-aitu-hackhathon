import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logout } from "@/api/auth";
import { useAuthStore } from "@/store/auth";
import client from "@/api/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
export default function Settings() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [admin, setAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    client
      .get("/capabilities")
      .then((r) => setAdmin(r.data.admin))
      .catch((e) => setError(e.message));
  }, []);
  const signout = async () => {
    setBusy(true);
    try {
      await logout();
      navigate("/login");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <MainLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Настройки</h1>
        {error && <p role="alert">{error}</p>}
        <section className="border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold">Язык интерфейса</h2>
          <LanguageSwitcher />
        </section>
        <section className="border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold">Аккаунт</h2>
          <p>{useAuthStore.getState().email}</p>
          <Button disabled={busy} variant="outline" onClick={signout}>
            Logout
          </Button>
        </section>
        <div className="flex flex-wrap gap-4">
          <Link className="text-primary underline" to="/onboarding">
            Опыт и данные профиля
          </Link>
          <Link className="text-primary underline" to="/legal/policies">
            Конфиденциальность
          </Link>
          {admin && (
            <Link className="text-primary underline" to="/admin/knowledge">
              Редактор базы знаний
            </Link>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
