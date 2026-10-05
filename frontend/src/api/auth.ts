import { tr } from "@/i18n/copy";
import { useResumeStore } from "@/store/resumeStore";
import { useInterviewStore } from "@/store/useInterviewStore";
import client from "./client";
import { refreshIdentity, useAuthStore } from "@/store/auth";
export async function loginWithEmail(email: string, password: string) {
  await client.post("/auth/login", { email, password });
  await refreshIdentity();
  if (!useAuthStore.getState().isAuthenticated)
    throw new Error(tr("copy.c001"));
}
export async function registerWithEmail(email: string, password: string) {
  await client.post("/session");
  await client.post("/auth/register", { email, password });
  await refreshIdentity();
  if (!useAuthStore.getState().isAuthenticated)
    throw new Error(tr("copy.c001"));
}
export async function logout() {
  await client.post("/auth/logout");
  useResumeStore.setState({
    resumeId: null,
    fields: null,
    revision: 0,
    jdText: "",
    improvements: [],
  });
  useInterviewStore.getState().reset();
  useAuthStore.getState().setUnauthenticated();
}
export async function loginWithGoogle() {
  await client.post("/session");
  const { data } = await client.post("/auth/google/nonce");
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
    window.google.accounts.id.initialize({
      client_id: data.client_id,
      nonce: data.nonce,
      callback: (result: { credential: string }) => {
        finish();
        resolve(result.credential);
      },
    });
    window.google.accounts.id.renderButton(button, {
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
