/**
 * Enhetlig felmodell för alla edge-endpoints (IK-04).
 * Inga stacktraces, inga uppströms-URL:er i svaret.
 */
export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'NOT_CONFIGURED'
  | 'UPSTREAM_UNAVAILABLE';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    retryAfter?: number;
  };
}

const STATUS: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  NOT_CONFIGURED: 503,
  UPSTREAM_UNAVAILABLE: 503,
};

export function apiError(code: ApiErrorCode, message: string, retryAfter?: number): Response {
  const body: ApiErrorBody =
    retryAfter === undefined ? { error: { code, message } } : { error: { code, message, retryAfter } };
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  if (retryAfter !== undefined) headers.set('Retry-After', String(retryAfter));
  return new Response(JSON.stringify(body), { status: STATUS[code], headers });
}
