import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store";

export function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) return null;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return children;
}
