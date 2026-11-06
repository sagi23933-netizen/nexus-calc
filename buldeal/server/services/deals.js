import fs from 'node:fs';
import path from 'node:path';
import { all, one, run, tx } from '../db.js';
import { nowIso, parseJson, wazeLink } from '../lib/utils.js';
import { UPLOAD_DIR } from '../config.js';
import { runtime } from '../lib/runtime.js';
import { notifyBusiness } from './notify.js';

const END_TEXT = {
  expired: 'הדיל הסתיים ונמחק אוטומטית מהאתר',
  removed_by_business: 'הדיל הוסר מהאתר לבקשתך',
  removed_by_admin: 'הדיל הוסר מהאתר על ידי צוות בולדיל',
  blocked: 'הדיל הוסר מהאתר כי החשבון אינו פעיל',
};

export function deleteUpload(publicUrl) {
  if (!publicUrl || !publicUrl.startsWith('/uploads/')) return;
  if (runtime.removeUpload) return runtime.removeUpload(publicUrl);
  const file = path.join(UPLOAD_DIR, path.basename(publicUrl));
  fs.promises.unlink(file).catch(() => {});
}

/**
 * Removes a deal from the site: the live record and its image are deleted, and a summary
 * (stats + slot for the "did it help?" feedback) is kept in deal_history.
 */
export const archiveDeal = tx((dealId, reason = 'expired', { notify = true } = {}) => {
  const d = one(
    `SELECT d.*, b.category_id, b.city_id FROM deals d JOIN businesses b ON b.id = d.business_id WHERE d.id = ?`,
    dealId,
  );
  if (!d) return null;
  const endedAt = nowIso();
  const info = run(
    `INSERT INTO deal_history(deal_id, business_id, title, original_price, discount_percent, final_price, duration_hours, started_at, ended_at,
      end_reason, category_id, city_id, design_source, views, clicks_phone, clicks_waze, clicks_share, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    d.id, d.business_id, d.title, d.original_price, d.discount_percent, d.final_price, d.duration_hours, d.starts_at,
    endedAt < d.expires_at ? endedAt : d.expires_at, reason, d.category_id, d.city_id, d.design_source, d.views, d.clicks_phone, d.clicks_waze,
    d.clicks_share, endedAt,
  );
  run('DELETE FROM deals WHERE id = ?', d.id);
  deleteUpload(d.image_url);
  if (notify) {
    const askFeedback = d.status === 'active';
    notifyBusiness(d.business_id, {
      type: askFeedback ? 'feedback' : 'deal',
      title: `${END_TEXT[reason] || 'הדיל הסתיים'}: ${d.title}`,
      body: askFeedback
        ? `הדיל נצפה ${d.views} פעמים, ${d.clicks_phone} לחיצות חיוג ו-${d.clicks_waze} ניווטים. ספרו לנו — האם הפרסום עזר והגיעו אנשים?`
        : '',
      link: `/dashboard/deals?feedback=${info.lastInsertRowid}`,
    });
  }
  return info.lastInsertRowid;
});

export function archiveBusinessDeals(businessId, reason) {
  for (const d of all('SELECT id FROM deals WHERE business_id = ?', businessId)) archiveDeal(d.id, reason);
}

/** Shape a deal row (joined with business/category/city) for clients. */
export function serializeDeal(row, { includeStats = false } = {}) {
  const showPhone = !!row.show_phone && !!row.biz_phone;
  const showAddress = !!row.show_address && !!row.biz_address;
  const waze = row.show_waze ? row.biz_waze_url || wazeLink({ address: row.biz_address, lat: row.biz_lat, lng: row.biz_lng }) : '';
  const out = {
    id: row.id,
    title: row.title,
    description: row.description,
    original_price: row.original_price,
    discount_percent: row.discount_percent,
    final_price: row.final_price,
    image_url: row.image_url,
    duration_hours: row.duration_hours,
    starts_at: row.starts_at,
    expires_at: row.expires_at,
    status: row.status,
    featured: !!row.featured || !!row.priority_listing,
    design: parseJson(row.design, {}),
    design_source: row.design_source,
    business: {
      id: row.business_id,
      name: row.biz_name,
      slug: row.biz_slug,
      logo_url: row.biz_logo,
      phone: showPhone ? row.biz_phone : '',
      whatsapp: row.show_phone ? row.biz_whatsapp || '' : '',
      address: showAddress ? row.biz_address : '',
      waze_url: waze,
    },
    category: row.category_id ? { id: row.category_id, name: row.category_name, slug: row.category_slug, icon: row.category_icon, color: row.category_color } : null,
    city: row.city_id ? { id: row.city_id, name: row.city_name, slug: row.city_slug } : null,
  };
  if (includeStats) {
    Object.assign(out, {
      views: row.views,
      clicks_phone: row.clicks_phone,
      clicks_waze: row.clicks_waze,
      clicks_share: row.clicks_share,
      redesigns: row.redesigns,
      ai_model: row.ai_model,
      show_phone: !!row.show_phone,
      show_address: !!row.show_address,
      show_waze: !!row.show_waze,
      created_at: row.created_at,
    });
  }
  return out;
}

export const DEAL_SELECT = `
  SELECT d.*, b.name AS biz_name, b.slug AS biz_slug, b.logo_url AS biz_logo, b.phone AS biz_phone, b.whatsapp AS biz_whatsapp,
         b.address AS biz_address, b.waze_url AS biz_waze_url, b.lat AS biz_lat, b.lng AS biz_lng, b.status AS biz_status,
         b.category_id, c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon, c.color AS category_color,
         b.city_id, ci.name AS city_name, ci.slug AS city_slug, COALESCE(p.priority_listing, 0) AS priority_listing
  FROM deals d
  JOIN businesses b ON b.id = d.business_id
  LEFT JOIN categories c ON c.id = b.category_id
  LEFT JOIN cities ci ON ci.id = b.city_id
  LEFT JOIN packages p ON p.id = b.package_id AND b.status = 'active'
`;
