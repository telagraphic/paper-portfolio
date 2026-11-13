import { useEffect, useState } from "react";

export function useChartFrame(key: string) {
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setShown(key), reduced ? 0 : 180);
    return () => window.clearTimeout(timer);
  }, [key]);

  return shown === key ? "ready" : "loading";
}
