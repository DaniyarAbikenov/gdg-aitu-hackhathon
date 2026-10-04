import axios from "axios";
import { auth } from "@/lib/firebase";

const client = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
});

client.interceptors.request.use(async (config) => {
    const user = auth.currentUser;
    if (user) {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default client;
