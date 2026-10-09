import { useQuery } from "@tanstack/react-query";
import client from "./client";

export interface Capabilities {
  ai: boolean;
  voice: boolean;
  admin: boolean;
  password_account: boolean;
  development: boolean;
}

export interface Health {
  status: string;
  provider: string;
  development: boolean;
}

export const systemKeys = {
  capabilities: ["capabilities"] as const,
  health: ["health"] as const,
};

export const capabilitiesQuery = {
  queryKey: systemKeys.capabilities,
  queryFn: async () => (await client.get<Capabilities>("/capabilities")).data,
};

export function useCapabilitiesQuery() {
  return useQuery(capabilitiesQuery);
}

const unavailable = { ai: false, voice: false };

/** Feature availability: null while unknown, everything disabled when the check fails. */
export function useCapabilities(): Pick<Capabilities, "ai" | "voice"> | null {
  const { data, isError } = useCapabilitiesQuery();
  return data ?? (isError ? unavailable : null);
}

export function useHealth() {
  return useQuery({
    queryKey: systemKeys.health,
    queryFn: async () => (await client.get<Health>("/health")).data,
  });
}
