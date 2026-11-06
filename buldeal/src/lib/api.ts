import { getVisitorIds } from './track';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Body = Record<string, unknown> | unknown[] | FormData | undefined;

async function request<T>(method: string, url: string, body?: Body, signal?: AbortSignal): Promise<T> {
  const ids = getVisitorIds();
  const headers: Record<string, string> = { 'X-Requested-With': 'buldeal', 'X-Visitor-Id': ids.visitor, 'X-Session-Id': ids.session };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(`/api${url}`, { method, headers, body: payload, credentials: 'same-origin', signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError('אין חיבור לשרת. בדקו את החיבור לאינטרנט.', 0);
  }
  const isJson = res.headers.get('content-type')?.includes('application/json');
  let data: unknown = null;
  if (isJson) {
    try {
      data = await res.json();
    } catch (err) {
      // a request cancelled mid-download must surface as an abort, not as an empty payload
      if (signal?.aborted || (err as Error).name === 'AbortError') throw err;
      data = {};
    }
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error || `שגיאה (${res.status})`;
    throw new ApiError(msg, res.status, (data as { code?: string })?.code);
  }
  return data as T;
}

export const api = {
  get: <T>(url: string, signal?: AbortSignal) => request<T>('GET', url, undefined, signal),
  post: <T>(url: string, body?: Body) => request<T>('POST', url, body ?? {}),
  put: <T>(url: string, body?: Body) => request<T>('PUT', url, body ?? {}),
  patch: <T>(url: string, body?: Body) => request<T>('PATCH', url, body ?? {}),
  del: <T>(url: string, body?: Body) => request<T>('DELETE', url, body ?? {}),
  upload: <T>(url: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<T>('POST', url, fd);
  },
};

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'שגיאה לא צפויה');

/** Build a query string, skipping empty values. */
export function qs(params: Record<string, string | number | boolean | null | undefined>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== '' && v !== null && v !== undefined && v !== false) s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : '';
}
