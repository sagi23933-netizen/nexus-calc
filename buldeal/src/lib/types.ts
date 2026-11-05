export type DealLayout = 'classic' | 'spotlight' | 'ribbon' | 'split';
export type DealPattern = 'none' | 'dots' | 'grid' | 'waves' | 'confetti' | 'sparkles' | 'stripes' | 'leaves' | 'bubbles';
export type DealFont = 'rubik' | 'secular' | 'varela' | 'suez' | 'frank' | 'karantina';
export type DealAnimation = 'none' | 'pulse' | 'shine' | 'float' | 'glow';

export interface DealDesign {
  layout: DealLayout;
  palette: { bg1: string; bg2: string; accent: string; text: string; priceBg: string; priceText: string };
  pattern: DealPattern;
  font: DealFont;
  headline: string;
  tagline: string;
  badge: string;
  emoji: string;
  ctaText: string;
  animation: DealAnimation;
  radius: 'soft' | 'round' | 'sharp';
  vibe: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
  color: string;
  deals?: number;
  ai_hint?: string;
  sort_order?: number;
  is_active?: number;
  businesses?: number;
  live_deals?: number;
}

export interface City {
  id: number;
  name: string;
  slug: string;
  region?: string;
  deals?: number;
  sort_order?: number;
  is_active?: number;
  businesses?: number;
  live_deals?: number;
}

export interface Deal {
  id: number;
  title: string;
  description: string;
  original_price: number;
  discount_percent: number;
  final_price: number;
  image_url: string;
  duration_hours: number;
  starts_at: string;
  expires_at: string;
  status: 'active' | 'scheduled';
  featured: boolean;
  design: DealDesign;
  design_source: 'ai' | 'builtin';
  business: {
    id: number;
    name: string;
    slug: string;
    logo_url: string;
    phone: string;
    whatsapp: string;
    address: string;
    waze_url: string;
  };
  category: { id: number; name: string; slug: string; icon: string; color: string } | null;
  city: { id: number; name: string; slug: string } | null;
  // stats (business/admin only)
  views?: number;
  clicks_phone?: number;
  clicks_waze?: number;
  clicks_share?: number;
  redesigns?: number;
  ai_model?: string;
  show_phone?: boolean;
  show_address?: boolean;
  show_waze?: boolean;
  created_at?: string;
  business_status?: string;
}

export type PackageRowType = 'feature' | 'text' | 'heading' | 'divider' | 'highlight' | 'spacer';
export interface PackageRow {
  id: string;
  type: PackageRowType;
  text: string;
  icon: string;
  included: boolean;
  bold?: boolean;
  color?: string;
}
export type StickerShape = 'ribbon' | 'circle' | 'tag' | 'star' | 'pill' | 'burst';
export interface PackageSticker {
  id: string;
  text: string;
  shape: StickerShape;
  color: string;
  textColor: string;
  x: number;
  y: number;
  rotate: number;
  size?: number;
}
export interface PackageTheme {
  preset?: string;
  bg1: string;
  bg2: string;
  accent: string;
  text: string;
  style?: 'glass' | 'solid' | 'gradient' | 'outline';
  elevation?: number;
}
export interface Package {
  id: number;
  name: string;
  kind: 'subscription' | 'tokens';
  subtitle: string;
  price: number;
  compare_price: number | null;
  period: 'month' | 'year' | 'once';
  tokens: number;
  priority_listing: boolean;
  theme: PackageTheme;
  rows: PackageRow[];
  stickers: PackageSticker[];
  cta_text: string;
  is_active: boolean;
  show_on_site: boolean;
  show_in_dashboard: boolean;
  sort_order: number;
  subscribers?: number;
  updated_at?: string;
}

export type BusinessStatus = 'trial' | 'active' | 'past_due' | 'blocked' | 'suspended';

export interface BusinessInfo {
  id: number;
  name: string;
  slug: string;
  category: { id: number; name: string; slug: string } | null;
  city: { id: number; name: string; slug: string } | null;
  logo_url: string;
  description: string;
  phone: string;
  whatsapp: string;
  address: string;
  waze_url: string;
  waze_auto: string;
  lat: number | null;
  lng: number | null;
  website: string;
  instagram: string;
  status: BusinessStatus;
  source: 'site' | 'admin';
  blocked_reason: string;
  trial: { days: number; started_at: string | null; ends_at: string | null };
  package: Package | null;
  needs_package: boolean;
  period_start: string | null;
  period_end: string | null;
  auto_renew: boolean;
  tokens: { balance: number; daily: number; available: number };
  card: { brand: string; last4: string; exp: string; holder: string } | null;
  counts: { live_deals: number; past_deals: number; pending_feedback: number; unread_notifications: number; unread_tickets: number };
  created_at: string;
  admin_notes?: string;
}

export interface Me {
  user: { id: number; email: string; role: 'admin' | 'business'; name: string; phone: string; mustChangePassword: boolean } | null;
  business?: BusinessInfo;
}

export interface PublicSettings {
  site: {
    name: string;
    tagline: string;
    heroTitle: string;
    heroSubtitle: string;
    contactEmail: string;
    contactPhone: string;
    whatsapp: string;
    footerText: string;
    announcementEnabled: boolean;
    announcementText: string;
    maintenanceMode: boolean;
  };
  trial: { siteDays: number; dailyTokens: number };
  deals: { maxHours: number; minHours: number; defaultHours: number; maxDiscount: number; freeRedesigns: number; requireImage: boolean };
  billing: { provider: string; currency: string; vatPercent: number; pricesIncludeVat: boolean };
}

export interface Bootstrap {
  settings: PublicSettings;
  categories: Category[];
  cities: City[];
  stats: { liveDeals: number; businesses: number };
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  link: string;
  read_at: string | null;
  created_at: string;
}

export interface HistoryItem {
  id: number;
  deal_id: number;
  business_id: number;
  title: string;
  original_price: number;
  discount_percent: number;
  final_price: number;
  duration_hours: number;
  started_at: string;
  ended_at: string;
  end_reason: 'expired' | 'removed_by_business' | 'removed_by_admin' | 'blocked';
  views: number;
  clicks_phone: number;
  clicks_waze: number;
  clicks_share: number;
  feedback: 'yes' | 'no' | null;
  feedback_customers: number | null;
  feedback_note: string;
  feedback_at: string | null;
  business?: string;
  city?: string;
  category?: string;
}

export interface Payment {
  id: number;
  business_id: number;
  package_id: number | null;
  kind: 'subscription' | 'tokens' | 'renewal';
  amount: number;
  vat: number;
  currency: string;
  status: 'paid' | 'failed' | 'refunded';
  provider: string;
  provider_ref: string;
  card_last4: string;
  description: string;
  failure_reason: string;
  invoice_number: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  business?: string;
}

export interface TokenTx {
  id: number;
  business_id: number;
  amount: number;
  balance_after: number;
  pool: 'balance' | 'daily';
  type: string;
  note: string;
  created_at: string;
  business?: string;
}

export interface Ticket {
  id: number;
  business_id: number | null;
  name: string;
  email: string;
  phone: string;
  subject: string;
  source: 'dashboard' | 'site';
  status: 'open' | 'pending' | 'closed';
  unread_admin: number;
  unread_business: number;
  last_message_at: string;
  created_at: string;
  last_message?: string;
  business?: string;
  logo_url?: string;
}

export interface TicketMessage {
  id: number;
  sender: 'business' | 'admin' | 'guest';
  body: string;
  created_at: string;
}

export interface CardInput {
  number: string;
  exp: string;
  cvv: string;
  holder: string;
}
