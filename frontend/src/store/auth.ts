import i18n from "@/i18n/config";
import { create } from "zustand";
import client from "@/api/client";
interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  uid: string | null;
  email: string | null;
  setAuthenticated: (uid: string, email: string) => void;
  setUnauthenticated: () => void;
}
export const useAuthStore = create<AuthState>((set) => ({
  isLoading: true,
  isAuthenticated: false,
  uid: null,
  email: null,
  setAuthenticated: (uid, email) =>
    set({ isLoading: false, isAuthenticated: true, uid, email }),
  setUnauthenticated: () =>
    set({ isLoading: false, isAuthenticated: false, uid: null, email: null }),
}));
export async function refreshIdentity() {
  try {
    const { data } = await client.get("/user/me");
    if (data.authenticated) {
      useAuthStore.getState().setAuthenticated(data.uid, data.email || "");
      const profile = await client.get("/user/profile");
      if (profile.data.revision > 0) {
        const language =
          profile.data.data.language === "kk"
            ? "kz"
            : profile.data.data.language;
        await i18n.changeLanguage(language);
        localStorage.setItem("language", language);
      }
    } else useAuthStore.getState().setUnauthenticated();
  } catch {
    useAuthStore.getState().setUnauthenticated();
  }
}
void refreshIdentity();
