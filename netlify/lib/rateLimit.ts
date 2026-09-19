/**
 * Hastighetsbegränsning per anropare (NFK-18), glidande fönster i minnet.
 *
 * Detta är ett skydd "per funktionsinstans": Netlify kan köra flera instanser
 * parallellt, så gränsen är en övre gräns per instans, inte globalt exakt.
 * Det räcker för att stoppa en enskild skrapare från att tömma kvoten;
 * kvotlarm vid 70 % (NFK-27) är den andra spärren.
 */
export interface RateLimiter {
  /** true om anropet får passera. */
  allow(key: string, now?: number): boolean;
}

export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const buckets = new Map<string, number[]>();
  let lastSweep = 0;

  function sweep(now: number): void {
    if (now - lastSweep < windowMs) return;
    lastSweep = now;
    for (const [key, times] of buckets) {
      const kept = times.filter((t) => now - t < windowMs);
      if (kept.length === 0) buckets.delete(key);
      else buckets.set(key, kept);
    }
  }

  return {
    allow(key, now = Date.now()) {
      sweep(now);
      const times = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
      if (times.length >= limit) {
        buckets.set(key, times);
        return false;
      }
      times.push(now);
      buckets.set(key, times);
      return true;
    },
  };
}
