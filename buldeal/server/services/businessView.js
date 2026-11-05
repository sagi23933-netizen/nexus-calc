import { one } from '../db.js';
import { wazeLink } from '../lib/utils.js';
import { tokenSummary } from './tokens.js';
import { serializePackage } from './packages.js';

/** Full business view used by the business dashboard (and admin detail). */
export function businessPayload(businessId) {
  const b = one(
    `SELECT b.*, c.name AS category_name, c.slug AS category_slug, ci.name AS city_name, ci.slug AS city_slug
     FROM businesses b LEFT JOIN categories c ON c.id = b.category_id LEFT JOIN cities ci ON ci.id = b.city_id WHERE b.id = ?`,
    businessId,
  );
  if (!b) return null;
  const pkg = b.package_id ? one('SELECT * FROM packages WHERE id = ?', b.package_id) : null;
  const counts = one(
    `SELECT (SELECT COUNT(*) FROM deals WHERE business_id = ?) AS live_deals,
            (SELECT COUNT(*) FROM deal_history WHERE business_id = ?) AS past_deals,
            (SELECT COUNT(*) FROM deal_history WHERE business_id = ? AND feedback IS NULL AND end_reason = 'expired') AS pending_feedback,
            (SELECT COUNT(*) FROM notifications WHERE business_id = ? AND audience = 'business' AND read_at IS NULL) AS unread_notifications,
            (SELECT COALESCE(SUM(unread_business), 0) FROM tickets WHERE business_id = ?) AS unread_tickets`,
    b.id, b.id, b.id, b.id, b.id,
  );
  return {
    id: b.id,
    name: b.name,
    slug: b.slug,
    category: b.category_id ? { id: b.category_id, name: b.category_name, slug: b.category_slug } : null,
    city: b.city_id ? { id: b.city_id, name: b.city_name, slug: b.city_slug } : null,
    logo_url: b.logo_url,
    description: b.description,
    phone: b.phone,
    whatsapp: b.whatsapp,
    address: b.address,
    waze_url: b.waze_url,
    waze_auto: wazeLink({ address: b.address, lat: b.lat, lng: b.lng }),
    lat: b.lat,
    lng: b.lng,
    website: b.website,
    instagram: b.instagram,
    status: b.status,
    source: b.source,
    blocked_reason: b.blocked_reason,
    trial: { days: b.trial_days, started_at: b.trial_started_at, ends_at: b.trial_ends_at },
    package: pkg ? serializePackage(pkg) : null,
    needs_package: !b.package_id,
    period_start: b.period_start,
    period_end: b.period_end,
    auto_renew: !!b.auto_renew,
    tokens: tokenSummary(b.id),
    card: b.card_last4 ? { brand: b.card_brand, last4: b.card_last4, exp: b.card_exp, holder: b.card_holder } : null,
    counts,
    created_at: b.created_at,
  };
}
