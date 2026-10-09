import { tr } from "@/i18n/copy";
import client from "@/api/client";
import type { Schemas } from "@/api/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { refreshIdentity, useAuthStore } from "./store";

export const authKeys = {
  options: ["auth", "options"] as const,
};

export function useAuthOptions() {
  return useQuery({
    queryKey: authKeys.options,
    queryFn: async () =>
      (
        await client.get<{ postgres: boolean; google: boolean }>(
          "/auth/options",
        )
      ).data,
  });
}

type Credentials = { email: string; password: string };

export function useLogin() {
  return useMutation({
    mutationFn: ({ email, password }: Credentials) =>
      loginWithEmail(email, password),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: ({ email, password }: Credentials) =>
      registerWithEmail(email, password),
  });
}

export function useGoogleLogin() {
  return useMutation({ mutationFn: loginWithGoogle });
}

/** Signing out resets the client-side stores and drops all cached server data. */
export function useLogout() {
  return useMutation({ mutationFn: logout });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (payload: Schemas["PasswordChange"]) => {
      await client.post("/account/password", payload);
    },
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async (payload: Schemas["AccountDelete"]) => {
      await client.post("/account/delete", payload);
    },
  });
}

async function loginWithEmail(email: string, password: string) {
  await client.post("/auth/login", { email, password });
  await refreshIdentity();
  if (!useAuthStore.getState().isAuthenticated)
    throw new Error(tr("copy.c001"));
}
async function registerWithEmail(email: string, password: string) {
  await client.post("/session");
  await client.post("/auth/register", { email, password });
  await refreshIdentity();
  if (!useAuthStore.getState().isAuthenticated)
    throw new Error(tr("copy.c001"));
}
async function logout() {
  await client.post("/auth/logout");
  useAuthStore.getState().setUnauthenticated();
}
async function loginWithGoogle() {
  await client.post("/session");
  const { data } = await client.post<{ client_id: string; nonce: string }>(
    "/auth/google/nonce",
  );
  // GIS returns an ID token; the server validates audience, signature and one-use nonce.
  if (!window.google)
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Google sign-in could not load."));
      document.head.append(script);
    });
  const google = window.google;
  if (!google) throw new Error("Google sign-in could not load.");
  const credential = await new Promise<string>((resolve, reject) => {
    const dialog = document.createElement("dialog");
    const button = document.createElement("div");
    const close = document.createElement("button");
    close.textContent = tr("copy.c002");
    dialog.style.padding = "24px";
    dialog.append(button, close);
    document.body.append(dialog);
    const finish = () => {
      dialog.close();
      dialog.remove();
    };
    close.onclick = () => {
      finish();
      reject(new Error("Google sign-in cancelled."));
    };
    dialog.oncancel = () => {
      finish();
      reject(new Error("Google sign-in cancelled."));
    };
    google.accounts.id.initialize({
      client_id: data.client_id,
      nonce: data.nonce,
      callback: (result: { credential: string }) => {
        finish();
        resolve(result.credential);
      },
    });
    google.accounts.id.renderButton(button, {
      theme: "outline",
      size: "large",
    });
    dialog.showModal();
  });
  await client.post("/auth/google", { credential });
  await refreshIdentity();
  if (!useAuthStore.getState().isAuthenticated)
    throw new Error(tr("copy.c001"));
}
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            nonce: string;
            callback: (r: { credential: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: { theme: string; size: string },
          ) => void;
        };
      };
    };
  }
}
