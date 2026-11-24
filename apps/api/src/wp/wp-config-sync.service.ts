import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { setSyncedServiceCities } from '../maps-location/places.js';
import { setAppRules } from './wp-link.js';
import { WpClientService } from './wp-client.service.js';
import { mapWpConfig, matchWpCity, type MappedConfig, type MappedRewards, type WpConfig } from './wp-config-map.js';

// Keeps our copy of the plugin's price list in step with the WordPress admin panel (ground rule 3 in
// docs/booking-flows-integrated.md: one price list). The plugin is the source of truth for cities, package
// prices per city, coupons, walk prices and reward rules; our admin panel no longer edits those while the
// integration is on.

const STATE_CONFIG = 'config'; // last config + derived settings (rewards, slot settings, breeds, …)
const STATE_STATUS = 'status'; // last attempt, last success, last error, warnings
const FAR_FUTURE = new Date('2099-12-31T23:59:59Z');
const EPOCH = new Date('2000-01-01T00:00:00Z');

export interface SyncResult {
  ok: boolean;
  skipped?: 'off' | 'busy';
  changed: boolean;
  warnings: string[];
  counts?: Record<string, number>;
  error?: string;
}

@Injectable()
export class WpConfigSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WpConfigSyncService.name);
  private running: Promise<SyncResult> | null = null;

  constructor(private prisma: PrismaService, private wp: WpClientService) {}

  onApplicationBootstrap() {
    // Load the last known cities right away, then refresh from the website without delaying start-up.
    void this.loadCachedCities();
    if (this.wp.enabled) setTimeout(() => void this.sync('startup'), 2_000);
    else this.logger.log('WordPress connection is off (WP_CONNECTOR_URL / WP_CONNECTOR_SECRET not set).');
  }

  @Cron('*/5 * * * *')
  scheduled() {
    // Same switch as the reminders: extra API instances can turn timed jobs off.
    if ((process.env['SCHEDULER_ENABLED'] ?? 'true') === 'false') return;
    if (this.wp.enabled) void this.sync('schedule');
  }

  /** One sync at a time; a second caller waits for the running one. */
  sync(trigger: string, force = false): Promise<SyncResult> {
    if (!this.wp.enabled) return Promise.resolve({ ok: false, skipped: 'off', changed: false, warnings: [] });
    if (!this.running) {
      this.running = this.run(trigger, force).finally(() => { this.running = null; });
    }
    return this.running;
  }

  private async run(trigger: string, force: boolean): Promise<SyncResult> {
    const attemptAt = new Date().toISOString();
    let cfg: WpConfig;
    try {
      cfg = await this.wp.get<WpConfig>('config');
    } catch (e) {
      const error = (e as Error).message;
      this.logger.warn(`Config sync (${trigger}) failed: ${error}`);
      await this.saveStatus({ lastAttemptAt: attemptAt, lastError: error, lastErrorAt: attemptAt });
      return { ok: false, changed: false, warnings: [], error };
    }

    const hash = createHash('sha256').update(JSON.stringify(cfg)).digest('hex');
    const prev = await this.prisma.wpSyncState.findUnique({ where: { key: STATE_CONFIG } });
    if (!force && (prev?.value as any)?.hash === hash) {
      await this.saveStatus({ lastAttemptAt: attemptAt, lastSuccessAt: attemptAt, lastError: null });
      return { ok: true, changed: false, warnings: ((await this.status()) as { warnings?: string[] }).warnings ?? [] };
    }

    const mapped = mapWpConfig(cfg);
    let counts: Record<string, number>;
    try {
      counts = await this.apply(mapped);
    } catch (e) {
      const error = `Could not save the website's price list: ${(e as Error).message}`;
      this.logger.error(error);
      await this.saveStatus({ lastAttemptAt: attemptAt, lastError: error, lastErrorAt: attemptAt });
      return { ok: false, changed: false, warnings: mapped.warnings, error };
    }

    const snapshot = {
      hash,
      version: cfg.version ?? null,
      rewards: mapped.rewards,
      settings: cfg.settings ?? {},
      blockedDays: cfg.blockedDays ?? [],
      breeds: cfg.breeds ?? {},
      aggression: cfg.aggression ?? [],
      insFields: cfg.insFields ?? [],
      apps: (cfg as any).apps ?? null,
      syncedAt: attemptAt,
    };
    await this.prisma.wpSyncState.upsert({
      where: { key: STATE_CONFIG },
      create: { key: STATE_CONFIG, value: snapshot as unknown as Prisma.InputJsonValue },
      update: { value: snapshot as unknown as Prisma.InputJsonValue },
    });
    await this.saveStatus({ lastAttemptAt: attemptAt, lastSuccessAt: attemptAt, lastChangeAt: attemptAt, lastError: null, warnings: mapped.warnings, counts });
    setSyncedServiceCities(mapped.cities.filter((c) => c.service).map((c) => c.name));
    setAppRules((cfg as any).apps ?? null);
    if (mapped.warnings.length) this.logger.warn(`Config sync warnings: ${mapped.warnings.join(' | ')}`);
    this.logger.log(`Config synced from the website (${trigger}): ${JSON.stringify(counts)}`);
    return { ok: true, changed: true, warnings: mapped.warnings, counts };
  }

  private async apply(m: MappedConfig): Promise<Record<string, number>> {
    return this.prisma.$transaction(async (tx) => {
      const counts = { cities: 0, packages: 0, packagesHidden: 0, coupons: 0, couponsHidden: 0, couponsSkipped: 0, walkPrices: 0 };

      // Cities
      for (const c of m.cities) {
        const data = { name: c.name, service: c.service, walking: c.walking, capacity: c.capacity, sortOrder: c.sortOrder, present: true };
        await tx.wpCity.upsert({ where: { id: c.id }, create: { id: c.id, ...data }, update: data });
        counts.cities++;
      }
      await tx.wpCity.updateMany({ where: { id: { notIn: m.cities.map((c) => c.id) }, present: true }, data: { present: false } });

      // Packages, their services and per-city prices
      if (m.packages.length > 0) {
        for (const p of m.packages) {
          const data = {
            name: p.name, mrp: p.mrp, price: p.price, applicableSpecies: p.applicableSpecies,
            durationMinutes: p.durationMinutes, isActive: true,
          };
          const row = await tx.groomingPackage.upsert({ where: { wpId: p.wpId }, create: { wpId: p.wpId, ...data }, update: data });
          await tx.groomingPackageItem.deleteMany({ where: { packageId: row.id } });
          if (p.items.length) await tx.groomingPackageItem.createMany({ data: p.items.map((description, order) => ({ packageId: row.id, description, order })) });
          await tx.groomingPackageCityPrice.deleteMany({ where: { packageId: row.id } });
          await tx.groomingPackageCityPrice.createMany({ data: Object.entries(p.cityPrices).map(([cityId, price]) => ({ packageId: row.id, cityId, price })) });
          counts.packages++;
        }
        // One price list: packages that are not on the website (removed there, or made only in our panel) are hidden.
        const hidden = await tx.groomingPackage.updateMany({
          where: { isActive: true, OR: [{ wpId: null }, { wpId: { notIn: m.packages.map((p) => p.wpId) } }] },
          data: { isActive: false },
        });
        counts.packagesHidden = hidden.count;
      }

      // Coupons (the plugin's coupons apply to grooming bookings)
      for (const c of m.coupons) {
        const existing = await tx.coupon.findUnique({ where: { code: c.code } });
        if (existing && existing.source !== 'wp') {
          counts.couponsSkipped++;
          m.warnings.push(`Coupon ${c.code} exists in both the website and the app panel; the app's own coupon was kept. Rename one of them.`);
          continue;
        }
        const data = {
          description: c.description, discountType: c.discountType, discountValue: c.discountValue,
          minOrderValue: c.minOrderValue, maxDiscount: null, applicableServices: ['grooming'],
          validFrom: EPOCH, validUntil: FAR_FUTURE, isActive: true, source: 'wp',
        };
        await tx.coupon.upsert({ where: { code: c.code }, create: { code: c.code, ...data }, update: data });
        counts.coupons++;
      }
      const goneCoupons = await tx.coupon.updateMany({
        where: { source: 'wp', isActive: true, code: { notIn: m.coupons.map((c) => c.code) } },
        data: { isActive: false },
      });
      counts.couponsHidden = goneCoupons.count;

      // Walk prices (walks are app-only; the plugin sets the price per length)
      if (m.walkPlans.length > 0) {
        for (const w of m.walkPlans) {
          await tx.walkPricing.upsert({
            where: { durationMinutes: w.durationMinutes },
            create: { durationMinutes: w.durationMinutes, price: w.price, isActive: true },
            update: { price: w.price, isActive: true },
          });
          counts.walkPrices++;
        }
        await tx.walkPricing.updateMany({ where: { durationMinutes: { notIn: m.walkPlans.map((w) => w.durationMinutes) } }, data: { isActive: false } });
      }
      return counts;
    }, { timeout: 60_000, maxWait: 10_000 });
  }

  private async saveStatus(patch: Record<string, unknown>) {
    const cur = ((await this.prisma.wpSyncState.findUnique({ where: { key: STATE_STATUS } }))?.value ?? {}) as Record<string, unknown>;
    const value = { ...cur, ...patch } as Prisma.InputJsonValue;
    await this.prisma.wpSyncState.upsert({ where: { key: STATE_STATUS }, create: { key: STATE_STATUS, value }, update: { value } }).catch((e) =>
      this.logger.error(`Could not save sync status: ${(e as Error).message}`)
    );
  }

  private async loadCachedCities() {
    try {
      const rows = await this.prisma.wpCity.findMany({ where: { present: true, service: true }, orderBy: { sortOrder: 'asc' } });
      if (rows.length) setSyncedServiceCities(rows.map((r) => r.name));
      const snap = await this.prisma.wpSyncState.findUnique({ where: { key: STATE_CONFIG } });
      if (this.wp.enabled) setAppRules(((snap?.value as any)?.apps as any) ?? null);
    } catch (e) {
      this.logger.warn(`Could not load cached cities: ${(e as Error).message}`);
    }
  }

  // ── Read side for the rest of the backend ────────────────────────────────────

  async status() {
    const [status, config] = await Promise.all([
      this.prisma.wpSyncState.findUnique({ where: { key: STATE_STATUS } }),
      this.prisma.wpSyncState.findUnique({ where: { key: STATE_CONFIG } }),
    ]);
    const s = (status?.value ?? {}) as Record<string, unknown>;
    return { enabled: this.wp.enabled, pluginVersion: (config?.value as any)?.version ?? null, ...s } as Record<string, unknown>;
  }

  async rewards(): Promise<MappedRewards | null> {
    const row = await this.prisma.wpSyncState.findUnique({ where: { key: STATE_CONFIG } });
    return ((row?.value as any)?.rewards as MappedRewards) ?? null;
  }

  async cities(opts: { includeHidden?: boolean } = {}) {
    return this.prisma.wpCity.findMany({ where: opts.includeHidden ? {} : { present: true }, orderBy: { sortOrder: 'asc' } });
  }

  /** The plugin city for a free-text city name, or null when it is not one of the website's cities. */
  async cityFor(name: string | null | undefined) {
    return matchWpCity(await this.cities(), name);
  }

  /** Price of a package in a city: the city price when the website has one, else the package's base price. */
  async packagePrice(packageId: string, cityName: string | null | undefined): Promise<number | null> {
    const pkg = await this.prisma.groomingPackage.findUnique({ where: { id: packageId }, include: { cityPrices: true } });
    if (!pkg) return null;
    const city = await this.cityFor(cityName);
    const cp = city ? pkg.cityPrices.find((c) => c.cityId === city.id) : undefined;
    return Number(cp?.price ?? pkg.price);
  }
}
