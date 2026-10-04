import axios, { AxiosError } from "axios";
import { FirebaseError } from "firebase/app";

export function getErrorMessage(err: unknown): string {
    // Firebase
    if (err instanceof FirebaseError) {
        // Можно отдать code вроде "auth/invalid-credential"
        return err.message || err.code || "Firebase error";
    }

    // Axios
    if (axios.isAxiosError(err)) {
        const ax = err as AxiosError<any>;
        // Пытаемся вытащить сообщение из ответа бэкенда в формате { error: { message } }
        const backendMsg =
            (ax.response?.data as any)?.error?.message ||
            (ax.response?.data as any)?.message;
        return backendMsg || ax.message || "Network error";
    }

    // Обычная Error
    if (err instanceof Error) {
        return err.message || "Unknown error";
    }

    // На крайний случай
    try {
        return JSON.stringify(err);
    } catch {
        return String(err);
    }
}
