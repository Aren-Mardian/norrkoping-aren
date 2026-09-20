/**
 * Gemensamt för edge-funktionernas uppströmsanrop: timeout (IK-06), omförsök med backoff och
 * jitter på transienta fel (IK-07), aldrig omförsök på 4xx. Besökarens IP och User-Agent
 * skickas aldrig vidare (NFK-23) — anropet görs med vår egen identitet.
 */

const UA = 'Norrkopingskartan/0.1 (+https://norrkoping.netlify.app)';

export interface UpstreamOptions {
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
}

export class UpstreamError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

export async function fetchUpstream(url: string, { timeoutMs = 8_000, retries = 2, headers = {} }: UpstreamOptions = {}): Promise<Response> {
  let lastError: UpstreamError | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...headers }, signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return res;
      await res.body?.cancel();
      if (res.status >= 400 && res.status < 500) throw new UpstreamError(`HTTP ${res.status}`, res.status);
      lastError = new UpstreamError(`HTTP ${res.status}`, res.status);
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof UpstreamError && err.status !== null && err.status < 500) throw err;
      lastError = err instanceof UpstreamError ? err : new UpstreamError((err as Error).name === 'AbortError' ? 'timeout' : (err as Error).message, null);
    }
    if (attempt < retries) {
      const backoff = 400 * 2 ** attempt + Math.random() * 300;
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastError ?? new UpstreamError('okänt fel', null);
}

export async function fetchJson<T>(url: string, options?: UpstreamOptions): Promise<T> {
  const res = await fetchUpstream(url, options);
  return (await res.json()) as T;
}

/** Kör `fn` över `items` med begränsad samtidighet — snällt mot små myndighets-API:er. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i] as T);
    }
  });
  await Promise.all(workers);
  return out;
}
