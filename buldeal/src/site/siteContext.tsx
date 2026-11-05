import { createContext, useContext } from 'react';
import type { Bootstrap, Category, City } from '../lib/types';

export interface SiteCtx {
  boot: Bootstrap | null;
  city: City | null;
  category: Category | null;
  q: string;
  sort: string;
  setCity: (slug: string | null) => void;
  setCategory: (slug: string | null) => void;
  setQ: (q: string) => void;
  setSort: (s: string) => void;
  openCityPicker: () => void;
  openContact: () => void;
}

export const SiteContext = createContext<SiteCtx | null>(null);

export function useSite() {
  const c = useContext(SiteContext);
  if (!c) throw new Error('useSite outside SiteLayout');
  return c;
}
