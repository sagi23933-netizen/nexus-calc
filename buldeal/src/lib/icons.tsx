import {
  Baby, BadgePercent, BarChart3, Car, Coffee, Dumbbell, Flame, Gift, Headphones, HeartPulse, Infinity as InfinityIcon, PartyPopper, PawPrint, Rocket,
  Shirt, ShoppingBasket, Smartphone, Sofa, Sparkles, Star, Tag, Ticket, UserRound, UtensilsCrossed, Wand2, Wrench, Zap, Crown, Check, ShieldCheck,
  Clock, Megaphone, TrendingUp, Gem, Heart, MapPin, Phone, Store, Scissors, Pizza, Plane, BookOpen, Music, Camera, type LucideIcon,
} from 'lucide-react';

/** Icons selectable by name (categories, package rows). */
export const ICONS: Record<string, LucideIcon> = {
  Baby, BadgePercent, BarChart3, Car, Coffee, Dumbbell, Flame, Gift, Headphones, HeartPulse, Infinity: InfinityIcon, PartyPopper, PawPrint, Rocket, Shirt,
  ShoppingBasket, Smartphone, Sofa, Sparkles, Star, Tag, Ticket, UserRound, UtensilsCrossed, Wand2, Wrench, Zap, Crown, Check, ShieldCheck, Clock, Megaphone,
  TrendingUp, Gem, Heart, MapPin, Phone, Store, Scissors, Pizza, Plane, BookOpen, Music, Camera,
};

export const ICON_NAMES = Object.keys(ICONS);

export function DynIcon({ name, className, size, strokeWidth }: { name?: string; className?: string; size?: number; strokeWidth?: number }) {
  const I = (name && ICONS[name]) || Tag;
  return <I className={className} size={size} strokeWidth={strokeWidth} />;
}
