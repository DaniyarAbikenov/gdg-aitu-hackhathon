import { tr } from "@/i18n/copy";
import axios from "axios";
const client = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 90000,
});
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const detail = error.response?.data?.detail;
    const exact: Record<string, string> = {
      "Incorrect email or password.": "credentials",
      "Incorrect current password.": "password",
      "Account already exists. Sign in instead.": "accountExists",
      "This company is already in your catalog.": "duplicate",
    };
    const status = error.response?.status;
    const type =
      typeof detail === "string" && exact[detail]
        ? exact[detail]
        : error.config?.url === "/applications/import" && status === 422
          ? "import"
          : {
              401: "auth",
              403: "forbidden",
              404: "notFound",
              409: "conflict",
              413: "validation",
              422: "validation",
              429: "limit",
              502: "provider",
              503: "network",
            }[status] || "network";
    error.message = tr("errors." + type);

    return Promise.reject(error);
  },
);
export default client;
