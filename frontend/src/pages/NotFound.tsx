import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold">404</h1>
        <p className="text-muted-foreground">
          Страница не найдена или адрес изменился.
        </p>
        <Button asChild>
          <Link to="/dashboard">Вернуться к обзору</Link>
        </Button>
      </div>
    </main>
  );
}
