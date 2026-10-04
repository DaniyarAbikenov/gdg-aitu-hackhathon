import { create } from "zustand";
import { auth } from "@/lib/firebase";

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
        set({ isAuthenticated: true, isLoading: false, uid, email }),

    setUnauthenticated: () =>
        set({ isAuthenticated: false, isLoading: false, uid: null, email: null }),
}));

// следим за Firebase auth state
auth.onAuthStateChanged((user) => {
    const { setAuthenticated, setUnauthenticated } = useAuthStore.getState();
    if (user) {
        setAuthenticated(user.uid, user.email ?? "");
    } else {
        setUnauthenticated();
    }
});
