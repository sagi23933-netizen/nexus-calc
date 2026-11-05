import { useMemo, useState } from 'react';
import { MapPin, Search, Check, Globe2 } from 'lucide-react';
import type { City } from '../lib/types';
import { Modal, cx } from '../shared/ui';

export function CityPicker({ open, onClose, cities, current, onPick }: { open: boolean; onClose: () => void; cities: City[]; current: City | null; onPick: (slug: string | null) => void }) {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const list = cities.filter((c) => !q || c.name.includes(q.trim()));
    const withDeals = list.filter((c) => (c.deals ?? 0) > 0).sort((a, b) => (b.deals ?? 0) - (a.deals ?? 0));
    const byRegion = new Map<string, City[]>();
    for (const c of list) {
      const r = c.region || 'אחר';
      byRegion.set(r, [...(byRegion.get(r) || []), c]);
    }
    return { withDeals, byRegion: [...byRegion.entries()] };
  }, [cities, q]);

  const pick = (slug: string | null) => {
    onPick(slug);
    onClose();
    setQ('');
  };

  const Btn = ({ c }: { c: City }) => (
    <button
      onClick={() => pick(c.slug)}
      className={cx(
        'flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-right text-[15px] font-semibold transition',
        current?.id === c.id ? 'bg-lime-500 text-leaf-950 shadow-3d' : 'bg-ink-50 hover:bg-lime-100',
      )}
    >
      <span className="truncate">{c.name}</span>
      {current?.id === c.id ? <Check size={16} /> : (c.deals ?? 0) > 0 ? <span className="rounded-full bg-white px-1.5 text-[11px] font-bold text-lime-700 shadow-sm">{c.deals}</span> : null}
    </button>
  );

  return (
    <Modal open={open} onClose={onClose} title="באיזו עיר מחפשים דילים?" size="lg">
      <div className="sticky top-0 z-10 -mx-1 bg-white px-1 pb-3">
        <div className="relative">
          <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש עיר…" className="input pr-10 text-base" />
        </div>
      </div>
      <button
        onClick={() => pick(null)}
        className={cx('mb-4 flex w-full items-center gap-3 rounded-2xl p-3 text-right font-bold transition', !current ? 'bg-leaf-700 text-white shadow-3d' : 'bg-ink-50 hover:bg-lime-100')}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
          <Globe2 size={20} />
        </span>
        כל הארץ
      </button>
      {groups.withDeals.length > 0 && !q && (
        <div className="mb-5">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink-500">
            <MapPin size={15} className="text-lime-600" /> ערים עם דילים פעילים עכשיו
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {groups.withDeals.map((c) => (
              <Btn key={c.id} c={c} />
            ))}
          </div>
        </div>
      )}
      {groups.byRegion.map(([region, list]) => (
        <div key={region} className="mb-4">
          <h3 className="mb-2 text-sm font-bold text-ink-500">{region}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {list.map((c) => (
              <Btn key={c.id} c={c} />
            ))}
          </div>
        </div>
      ))}
      {groups.byRegion.length === 0 && <p className="py-8 text-center text-ink-500">לא נמצאה עיר בשם הזה</p>}
    </Modal>
  );
}
