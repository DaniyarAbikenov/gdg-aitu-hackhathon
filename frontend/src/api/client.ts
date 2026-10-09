import { tr } from "@/i18n/copy";
import axios from "axios";

const client = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 90000,
});

/** Backend error codes that have their own translated message. */
const messageByCode: Record<string, string> = {
  invalid_credentials: "credentials",
  wrong_password: "password",
  account_exists: "accountExists",
  duplicate_company: "duplicate",
  vacancy_import_failed: "import",
  session_expired: "auth",
  sign_in_required: "auth",
  google_sign_in_failed: "auth",
  forbidden: "forbidden",
  admin_only: "forbidden",
  cross_origin: "forbidden",
  not_found: "notFound",
  conflict: "conflict",
  text_interview: "conflict",
  signed_in: "conflict",
  rate_limited: "limit",
  letter_needs_facts: "letterFacts",
  provider_unavailable: "provider",
  google_unavailable: "provider",
  validation_failed: "validation",
  invalid_input: "validation",
  payload_too_large: "validation",
  storage_unavailable: "network",
};

/** Fallback for responses without a code, such as proxy errors or unknown routes. */
const messageByStatus: Record<number, string> = {
  401: "auth",
  403: "forbidden",
  404: "notFound",
  409: "conflict",
  413: "validation",
  422: "validation",
  429: "limit",
  502: "provider",
  503: "network",
};

/** The translated message for a backend error code, falling back to the HTTP status. */
export function errorMessage(code: unknown, status?: number): string {
  const key =
    (typeof code === "string" && messageByCode[code]) ||
    (status !== undefined && messageByStatus[status]) ||
    "network";
  return tr("errors." + key);
}

client.interceptors.response.use(
  (response) => response,
  (error) => {
    error.message = errorMessage(
      error.response?.data?.code,
      error.response?.status,
    );
    return Promise.reject(error);
  },
);

export default client;
