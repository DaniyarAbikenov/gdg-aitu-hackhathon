import { useEffect, useState } from "react";
import client from "@/api/client";
export function useCapabilities() {
  const [capabilities, setCapabilities] = useState<{
    ai: boolean;
    voice: boolean;
  } | null>(null);
  useEffect(() => {
    let active = true;
    client
      .get("/capabilities")
      .then((r) => {
        if (active) setCapabilities(r.data);
      })
      .catch(() => {
        if (active) setCapabilities({ ai: false, voice: false });
      });
    return () => {
      active = false;
    };
  }, []);
  return capabilities;
}
