import client from "./client";
import { auth, googleProvider } from "@/lib/firebase";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
} from "firebase/auth";

export async function loginWithEmail(email: string, password: string) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await cred.user.getIdToken();
    return { token: idToken, uid: cred.user.uid };
}

export async function registerWithEmail(email: string, password: string) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const idToken = await cred.user.getIdToken();
    return { token: idToken, uid: cred.user.uid };
}

export async function loginWithGoogle() {
    const cred = await signInWithPopup(auth, googleProvider);
    const idToken = await cred.user.getIdToken();
    return { token: idToken, uid: cred.user.uid };
}
