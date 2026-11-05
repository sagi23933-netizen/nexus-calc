// Refreshes the demo businesses' deals so the site looks alive (deals expire within 48h by design).
import '../config.js';
import { seedBase, ensureAdmin } from '../seed.js';
import { seedDemo } from '../demo.js';

seedBase();
await ensureAdmin();
await seedDemo({ refreshDeals: true });
console.log('[buldeal] דילי ההדגמה רועננו');
process.exit(0);
