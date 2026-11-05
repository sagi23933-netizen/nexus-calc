const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function safeGet(store: Storage | undefined, key: string) {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
function safeSet(store: Storage | undefined, key: string, v: string) {
  try {
    store?.setItem(key, v);
  } catch {
    /* storage unavailable */
  }
}

let memo: { visitor: string; session: string } | null = null;

/** Anonymous random ids (no personal data) used for unique-visitor analytics. */
export function getVisitorIds() {
  if (memo) return memo;
  const ls = typeof window !== 'undefined' ? window.localStorage : undefined;
  const ss = typeof window !== 'undefined' ? window.sessionStorage : undefined;
  let visitor = safeGet(ls, 'bd_vid');
  if (!visitor) {
    visitor = rid();
    safeSet(ls, 'bd_vid', visitor);
  }
  let session = safeGet(ss, 'bd_sid');
  if (!session) {
    session = rid();
    safeSet(ss, 'bd_sid', session);
  }
  memo = { visitor, session };
  return memo;
}

export function track(type: string, data: Record<string, unknown> = {}) {
  const ids = getVisitorIds();
  const params = new URLSearchParams(window.location.search);
  const body = JSON.stringify({
    type,
    path: window.location.pathname + window.location.search,
    referrer: document.referrer,
    utm: params.get('utm_source') || '',
    visitorId: ids.visitor,
    sessionId: ids.session,
    ...data,
  });
  fetch('/api/public/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'buldeal' },
    body,
    keepalive: true,
  }).catch(() => {});
}

export function trackDeal(id: number, type: 'view' | 'phone' | 'waze' | 'share') {
  const ids = getVisitorIds();
  fetch(`/api/public/deals/${id}/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'buldeal', 'X-Visitor-Id': ids.visitor, 'X-Session-Id': ids.session },
    body: JSON.stringify({ type, path: window.location.pathname }),
    keepalive: true,
  }).catch(() => {});
}

const seenDeals = new Set<number>();
export function trackDealViewOnce(id: number) {
  if (seenDeals.has(id)) return;
  seenDeals.add(id);
  trackDeal(id, 'view');
}
