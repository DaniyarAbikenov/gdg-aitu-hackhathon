import { useResumeStore } from "@/features/resume/store";
import { useInterviewStore } from "@/features/interview/store";
import { profileQuery } from "@/features/profile/api";
import { queryClient } from "@/app/queryClient";
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
interface Identity {
  uid: string;
  authenticated: boolean;
  email: string | null;
}
export const useAuthStore = create<AuthState>((set, get) => ({
  isLoading: true,
  isAuthenticated: false,
  uid: null,
  email: null,
  setAuthenticated: (uid, email) => {
    // Cached server data belongs to one identity; drop it when the identity changes.
    if (!get().isLoading && get().uid !== uid) queryClient.clear();
    set({ isLoading: false, isAuthenticated: true, uid, email });
  },
  setUnauthenticated: () => {
    useResumeStore.getState().reset();
    useInterviewStore.getState().reset();
    if (!get().isLoading) queryClient.clear();
    set({ isLoading: false, isAuthenticated: false, uid: null, email: null });
  },
}));
export async function refreshIdentity() {
  try {
    const { data } = await client.get<Identity>("/user/me");
    if (data.authenticated) {
      useAuthStore.getState().setAuthenticated(data.uid, data.email || "");
      const profile = await queryClient.fetchQuery(profileQuery);
      if (profile.revision > 0) {
        const language =
          profile.data.language === "kk" ? "kz" : profile.data.language;
        await i18n.changeLanguage(language);
        localStorage.setItem("language", language);
      }
    } else useAuthStore.getState().setUnauthenticated();
  } catch {
    useAuthStore.getState().setUnauthenticated();
  }
}
void refreshIdentity();
