import { useEffect, useState } from "react";

const QUERY = "(max-width: 639px)";

/** Phones get portrait drawings; without matchMedia (tests) the wide one is used. */
export function useCompact() {
  const supported =
    typeof window !== "undefined" && typeof window.matchMedia === "function";
  const [compact, setCompact] = useState(
    () => supported && window.matchMedia(QUERY).matches,
  );
  useEffect(() => {
    if (!supported) return;
    const media = window.matchMedia(QUERY);
    const change = () => setCompact(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, [supported]);
  return compact;
}
