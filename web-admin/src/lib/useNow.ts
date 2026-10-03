import {useEffect, useState} from "react";

/**
 * The current time for "5 phút trước" labels and date windows, read once on
 * mount and refreshed every `everyMs` — render itself stays pure.
 */
export function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}
