// Turns the plugin's config (GET connector/config) into rows for our tables. Pure functions, no I/O, so the
// rules are easy to test. Anything malformed is skipped with a warning instead of failing the whole sync.

export interface WpConfig {
  cities?: any[];
  packages?: any[];
  walkPlans?: any[];
  coupons?: any[];
  rewards?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  breeds?: Record<string, string[]>;
  aggression?: string[];
  insFields?: unknown[];
  blockedDays?: unknown;
  version?: string;
}

export interface MappedCity { id: string; name: string; service: boolean; walking: boolean; capacity: number | null; sortOrder: number }
export interface MappedPackage {
  wpId: string;
  name: string;
  mrp: number;
  price: number; // lowest price among the cities that take bookings ("from ₹…")
  applicableSpecies: string[];
  durationMinutes: number | null;
  items: string[];
  cityPrices: Record<string, number>;
}
export interface MappedCoupon { code: string; description: string; discountType: 'percent' | 'flat'; discountValue: number; minOrderValue: number | null }
export interface MappedWalkPlan { durationMinutes: number; price: number }
export interface MappedRewards {
  enabled: boolean;
  bookingRate: number; // points earned per ₹100 of a booking (plugin semantics)
  orderRate: number;
  pointValue: number; // ₹ per point
  minRedeem: number;
  maxPct: number; // most of a bill payable with points, in %
  signupBonus: number;
}

export interface MappedConfig {
  cities: MappedCity[];
  packages: MappedPackage[];
  coupons: MappedCoupon[];
  walkPlans: MappedWalkPlan[];
  rewards: MappedRewards;
  warnings: string[];
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const money = (n: number) => Math.round(n * 100) / 100;

export function mapWpConfig(cfg: WpConfig): MappedConfig {
  const warnings: string[] = [];

  const cities: MappedCity[] = [];
  const cityIds = new Set<string>();
  (cfg.cities ?? []).forEach((c, i) => {
    const id = str(c?.id);
    const name = str(c?.name);
    if (!id || !name) return warnings.push(`City #${i + 1} has no id or name; skipped`);
    if (cityIds.has(id)) return warnings.push(`City "${id}" is listed twice; the second is skipped`);
    cityIds.add(id);
    const cap = num(c?.capacity);
    cities.push({ id, name, service: c?.service !== false, walking: c?.walking === true, capacity: cap !== null && cap >= 0 ? Math.floor(cap) : null, sortOrder: i });
  });
  const serviceCityIds = new Set(cities.filter((c) => c.service).map((c) => c.id));

  const packages: MappedPackage[] = [];
  const pkgIds = new Set<string>();
  for (const p of cfg.packages ?? []) {
    const wpId = str(p?.id);
    const name = str(p?.name);
    if (!wpId || !name) { warnings.push('A package has no id or name; skipped'); continue; }
    if (pkgIds.has(wpId)) { warnings.push(`Package "${wpId}" is listed twice; the second is skipped`); continue; }
    const cityPrices: Record<string, number> = {};
    for (const [cityId, raw] of Object.entries(p?.prices ?? {})) {
      const v = num(raw);
      if (!cityIds.has(cityId)) continue; // price for a city that no longer exists
      if (v === null || v <= 0) { warnings.push(`Package "${name}" has no valid price for ${cityId}`); continue; }
      cityPrices[cityId] = money(v);
    }
    const bookable = Object.entries(cityPrices).filter(([c]) => serviceCityIds.has(c)).map(([, v]) => v);
    const all = Object.values(cityPrices);
    if (all.length === 0) { warnings.push(`Package "${name}" has no prices; skipped`); continue; }
    pkgIds.add(wpId);
    const price = Math.min(...(bookable.length ? bookable : all));
    const mrpIn = num(p?.mrp);
    const mrp = mrpIn !== null && mrpIn >= price ? money(mrpIn) : Math.max(...all);
    const pet = str(p?.pet).toLowerCase();
    const species = pet === 'dog' ? ['dog'] : pet === 'cat' ? ['cat'] : ['dog', 'cat'];
    const mins = num(p?.mins) ?? num(/(\d+)/.exec(str(p?.duration))?.[1]);
    const items = Array.isArray(p?.items) ? p.items.map(str).filter(Boolean).slice(0, 50) : [];
    packages.push({ wpId, name, mrp, price, applicableSpecies: species, durationMinutes: mins && mins > 0 ? Math.round(mins) : null, items, cityPrices });
  }

  const coupons: MappedCoupon[] = [];
  const codes = new Set<string>();
  for (const c of cfg.coupons ?? []) {
    if (c?.active === false) continue;
    const code = str(c?.code).toUpperCase();
    const value = num(c?.value);
    const type = str(c?.type) === 'pct' ? 'percent' : str(c?.type) === 'flat' ? 'flat' : null;
    if (!code || !type || value === null || value <= 0 || (type === 'percent' && value > 100)) { warnings.push(`Coupon "${code || '?'}" is not valid; skipped`); continue; }
    if (codes.has(code)) continue;
    codes.add(code);
    const min = num(c?.min);
    coupons.push({ code, description: str(c?.desc) || code, discountType: type, discountValue: money(value), minOrderValue: min && min > 0 ? money(min) : null });
  }

  const walkPlans: MappedWalkPlan[] = [];
  for (const w of cfg.walkPlans ?? []) {
    const mins = num(/(\d+)/.exec(`${str(w?.name)} ${str(w?.id)}`)?.[1]);
    const price = num(w?.price);
    if (!mins || mins <= 0 || price === null || price <= 0) { warnings.push(`Walk plan "${str(w?.name) || str(w?.id)}" has no length in minutes or no price; skipped`); continue; }
    if (walkPlans.some((x) => x.durationMinutes === mins)) continue;
    walkPlans.push({ durationMinutes: mins, price: money(price) });
  }

  const r = cfg.rewards ?? {};
  const rn = (k: string, d: number) => { const v = num((r as any)[k]); return v !== null && v >= 0 ? v : d; };
  const rewards: MappedRewards = {
    enabled: (r as any).enabled !== false,
    bookingRate: rn('bookingRate', 0),
    orderRate: rn('orderRate', 0),
    pointValue: rn('pointValue', 1),
    minRedeem: rn('minRedeem', 0),
    maxPct: Math.min(100, rn('maxPct', 0)),
    signupBonus: rn('signupBonus', 0),
  };

  return { cities, packages, coupons, walkPlans, rewards, warnings };
}

/** Plugin city for a free-text city name ("lucknow ", "Pimpri Chinchwad (Pune)"). */
export function matchWpCity<T extends { id: string; name: string }>(cities: T[], name: string | null | undefined): T | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  return cities.find((c) => c.name.toLowerCase() === n || c.id.toLowerCase() === n) ?? null;
}
