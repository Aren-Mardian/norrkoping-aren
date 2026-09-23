/**
 * Klientens nätverksanrop (IK-06, IK-07): timeout och avbrytbarhet via AbortController,
 * max 2 omförsök med exponentiell backoff och jitter på transienta fel, aldrig omförsök på 4xx.
 * Avbrutna anrop loggar inte fel.
 */

export interface FetchJsonOptions {
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal | undefined;
  /** Standard är GET. POST används för batchanrop (höjdprofil, IK-08). */
  method?: 'GET' | 'POST';
  body?: string;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export async function fetchJson<T>(url: string, { timeoutMs = 8_000, retries = 2, signal, method = 'GET', body }: FetchJsonOptions = {}): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const onAbort = (): void => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        ...(body === undefined ? {} : { body }),
        signal: controller.signal,
        headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      });
      if (res.ok) return (await res.json()) as T;
      if (res.status >= 400 && res.status < 500) throw new HttpError(res.status, `HTTP ${res.status}`);
      lastError = new HttpError(res.status, `HTTP ${res.status}`);
    } catch (err) {
      if (signal?.aborted) throw err; // avbrutet av anroparen — inget fel att rapportera
      if (err instanceof HttpError && err.status < 500) throw err;
      lastError = err;
    } finally {
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
    if (attempt < retries) await new Promise((r) => window.setTimeout(r, 500 * 2 ** attempt + Math.random() * 300));
  }
  throw lastError instanceof Error ? lastError : new Error('Nätverksfel');
}
