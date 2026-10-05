import { tr, useLocale } from "@/i18n/copy";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  useLocale();
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold">404</h1>
        <p className="text-muted-foreground">{tr("copy.c390")}</p>
        <Button asChild>
          <Link to="/dashboard">{tr("copy.c391")}</Link>
        </Button>
      </div>
    </main>
  );
}
