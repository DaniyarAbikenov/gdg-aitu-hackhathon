import { QueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";

/** Client errors are final; only network and server failures are retried once. */
function retry(failureCount: number, error: unknown) {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  return failureCount < 1 && (status === undefined || status >= 500);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry },
    mutations: { retry: false },
  },
});
