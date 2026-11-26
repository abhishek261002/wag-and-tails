import { createHmac } from 'crypto';
import { canonicalRoute, signedHeaders, verifyWpSignature, wpSignature } from './wp-sign';
import { mapWpConfig, matchWpCity } from './wp-config-map';

describe('wp-sign', () => {
  it('sorts the query and encodes it like PHP http_build_query', () => {
    expect(canonicalRoute('/wt/v1/connector/slots', { date: '2026-11-20', city: 'lucknow', pkg: 'pk full' })).toBe(
      '/wt/v1/connector/slots?city=lucknow&date=2026-11-20&pkg=pk+full'
    );
    expect(canonicalRoute('/wt/v1/connector/changes', { since: '2026-11-18 10:00:00', afterId: 7 })).toBe(
      '/wt/v1/connector/changes?afterId=7&since=2026-11-18+10%3A00%3A00'
    );
    expect(canonicalRoute('/wt/v1/connector/config')).toBe('/wt/v1/connector/config');
    expect(canonicalRoute('/x', { a: undefined, b: '' })).toBe('/x');
  });

  it('signs ts, nonce, method, route and body joined by newlines', () => {
    const exp = createHmac('sha256', 's3cret').update('100\nabc\nPOST\n/r\n{"a":1}').digest('hex');
    expect(wpSignature('s3cret', '100', 'abc', 'post', '/r', '{"a":1}')).toBe(exp);
  });

  it('accepts its own signature and rejects tampering, old messages and bad nonces', () => {
    const now = 1_800_000_000_000;
    const h = signedHeaders('k', 'POST', '/api/v1/connector/events', '{"x":1}', now);
    const hdr = { ts: h['X-WT-Timestamp'], nonce: h['X-WT-Nonce'], sig: h['X-WT-Signature'] };
    expect(verifyWpSignature('k', hdr, 'POST', '/api/v1/connector/events', '{"x":1}', now)).toBe(true);
    expect(verifyWpSignature('k', hdr, 'POST', '/api/v1/connector/events', '{"x":2}', now)).toBe(false);
    expect(verifyWpSignature('other', hdr, 'POST', '/api/v1/connector/events', '{"x":1}', now)).toBe(false);
    expect(verifyWpSignature('k', hdr, 'POST', '/api/v1/connector/events', '{"x":1}', now + 301_000)).toBe(false);
    expect(verifyWpSignature('k', { ...hdr, nonce: 'short' }, 'POST', '/api/v1/connector/events', '{"x":1}', now)).toBe(false);
    expect(verifyWpSignature('', hdr, 'POST', '/api/v1/connector/events', '{"x":1}', now)).toBe(false);
  });
});

describe('mapWpConfig', () => {
  const cfg = {
    cities: [
      { id: 'kanpur', name: 'Kanpur', service: true, walking: true, capacity: 3 },
      { id: 'north-mumbai', name: 'North Mumbai', service: true, walking: false },
      { id: 'jaipur', name: 'Jaipur', service: false },
      { id: 'kanpur', name: 'Kanpur again' },
      { name: 'No id' },
    ],
    packages: [
      { id: 'pkfull', name: 'Full Grooming', pet: 'Dog', duration: '90 min', mins: 90, mrp: 2499, items: ['Haircut', ' ', 'Teeth'], prices: { kanpur: 1699, 'north-mumbai': 1999, jaipur: 1500, gone: 10 } },
      { id: 'cat', name: 'Cat Care', pet: 'Both', duration: '75 min', prices: { kanpur: '1099' } },
      { id: 'noprice', name: 'Broken', prices: {} },
    ],
    coupons: [
      { code: 'pamper', type: 'pct', value: 10, min: 0, desc: '10% off', active: true },
      { code: 'FEST', type: 'flat', value: 200, min: 1699, active: true },
      { code: 'OFF', type: 'flat', value: 50, active: false },
      { code: 'BAD', type: 'pct', value: 150, active: true },
    ],
    walkPlans: [{ id: 'w30', name: '30-minute walk', price: 199 }, { id: 'w60', name: '60-minute walk', price: '349' }, { id: 'x', name: 'Long walk', price: 500 }],
    rewards: { enabled: true, bookingRate: 10, pointValue: 1, minRedeem: 100, maxPct: 150, signupBonus: 100 },
  };
  const m = mapWpConfig(cfg);

  it('maps cities, skipping duplicates and rows without an id', () => {
    expect(m.cities.map((c) => c.id)).toEqual(['kanpur', 'north-mumbai', 'jaipur']);
    expect(m.cities[0]).toMatchObject({ walking: true, capacity: 3, service: true });
    expect(m.cities[2]!.service).toBe(false);
    expect(m.warnings.join(' ')).toMatch(/listed twice/);
  });

  it('maps packages with per-city prices; the base price is the cheapest city that takes bookings', () => {
    const full = m.packages.find((p) => p.wpId === 'pkfull')!;
    expect(full.cityPrices).toEqual({ kanpur: 1699, 'north-mumbai': 1999, jaipur: 1500 });
    expect(full.price).toBe(1699); // jaipur (1500) is not taking bookings
    expect(full.mrp).toBe(2499);
    expect(full.applicableSpecies).toEqual(['dog']);
    expect(full.durationMinutes).toBe(90);
    expect(full.items).toEqual(['Haircut', 'Teeth']);
    const cat = m.packages.find((p) => p.wpId === 'cat')!;
    expect(cat).toMatchObject({ price: 1099, mrp: 1099, applicableSpecies: ['dog', 'cat'], durationMinutes: 75 });
    expect(m.packages.find((p) => p.wpId === 'noprice')).toBeUndefined();
  });

  it('maps active, valid coupons only', () => {
    expect(m.coupons).toEqual([
      { code: 'PAMPER', description: '10% off', discountType: 'percent', discountValue: 10, minOrderValue: null },
      { code: 'FEST', description: 'FEST', discountType: 'flat', discountValue: 200, minOrderValue: 1699 },
    ]);
  });

  it('maps walk plans by their length in minutes', () => {
    expect(m.walkPlans).toEqual([{ durationMinutes: 30, price: 199 }, { durationMinutes: 60, price: 349 }]);
    expect(m.warnings.join(' ')).toMatch(/Long walk/);
  });

  it('maps reward rules with safe defaults', () => {
    expect(m.rewards).toEqual({ enabled: true, bookingRate: 10, orderRate: 0, pointValue: 1, minRedeem: 100, maxPct: 100, signupBonus: 100 });
  });

  it('copes with an empty config', () => {
    const e = mapWpConfig({});
    expect(e).toMatchObject({ cities: [], packages: [], coupons: [], walkPlans: [] });
  });

  it('matches free-text city names to website cities', () => {
    expect(matchWpCity(m.cities, ' north mumbai ')?.id).toBe('north-mumbai');
    expect(matchWpCity(m.cities, 'kanpur')?.id).toBe('kanpur');
    expect(matchWpCity(m.cities, 'Delhi')).toBeNull();
    expect(matchWpCity(m.cities, null)).toBeNull();
  });
});

import { channelForSource, dateToIst, dobFromAge, escalationDeadline, istToDate, jobStatusFor, toAppPhone, toPluginPhone } from './wp-link';

describe('wp-link', () => {
  it('converts phones between the app and the plugin', () => {
    expect(toPluginPhone('+919876543210')).toBe('9876543210');
    expect(toPluginPhone('09876543210')).toBe('9876543210');
    expect(toPluginPhone('12345')).toBeNull();
    expect(toAppPhone('9876543210')).toBe('+919876543210');
    expect(toAppPhone('5876543210')).toBeNull();
  });

  it('converts India-time dates both ways', () => {
    const at = istToDate('2026-11-20', '11:30')!;
    expect(at.toISOString()).toBe('2026-11-20T06:00:00.000Z');
    expect(dateToIst(at)).toEqual({ date: '2026-11-20', start: '11:30' });
    expect(dateToIst(new Date('2026-11-20T20:00:00Z'))).toEqual({ date: '2026-11-21', start: '01:30' });
    expect(istToDate('2026-11-20', 'x')).toBeNull();
  });

  it('maps the plugin source to a booking channel', () => {
    expect(channelForSource('Website')).toBe('website');
    expect(channelForSource('App')).toBe('app');
    expect(channelForSource('Phone call')).toBe('phone_call');
    expect(channelForSource('WhatsApp')).toBe('whatsapp');
    expect(channelForSource('Redo')).toBe('other');
  });

  describe('escalation deadline (decision 2A)', () => {
    const ist = (d: string, t: string) => istToDate(d, t)!;
    it('same day: 15 minutes', () => {
      expect(escalationDeadline(ist('2026-11-20', '09:00'), ist('2026-11-20', '15:00'))).toEqual(ist('2026-11-20', '09:15'));
    });
    it('next day: 2 hours, but by 6 pm the day before', () => {
      expect(escalationDeadline(ist('2026-11-20', '10:00'), ist('2026-11-21', '11:00'))).toEqual(ist('2026-11-20', '12:00'));
      expect(escalationDeadline(ist('2026-11-20', '17:00'), ist('2026-11-21', '11:00'))).toEqual(ist('2026-11-20', '18:00'));
      expect(escalationDeadline(ist('2026-11-20', '19:00'), ist('2026-11-21', '11:00'))).toEqual(ist('2026-11-20', '19:15'));
    });
    it('later: 2 hours', () => {
      expect(escalationDeadline(ist('2026-11-20', '10:00'), ist('2026-11-25', '11:00'))).toEqual(ist('2026-11-20', '12:00'));
    });
    it('never later than 30 minutes before the start', () => {
      expect(escalationDeadline(ist('2026-11-20', '10:00'), ist('2026-11-20', '10:40'))).toEqual(ist('2026-11-20', '10:10'));
    });
  });

  it('shows the right desk job status', () => {
    expect(jobStatusFor({ status: 'needs_partner' })).toBe('searching');
    expect(jobStatusFor({ status: 'needs_partner', assignmentMode: 'specific' })).toBe('offered');
    expect(jobStatusFor({ status: 'needs_partner', staffFlag: 'no_partner' })).toBe('needs_staff');
    expect(jobStatusFor({ status: 'partner_on_the_way' })).toBe('on_the_way');
    expect(jobStatusFor({ status: 'refunded' })).toBe('cancelled');
  });

  it('estimates a date of birth from an age', () => {
    const now = new Date('2026-11-18T00:00:00Z');
    expect(dobFromAge('3', 'years', now)?.toISOString().slice(0, 7)).toBe('2023-11');
    expect(dobFromAge('8', 'months', now)?.toISOString().slice(0, 7)).toBe('2026-03');
    expect(dobFromAge('', 'years', now)).toBeNull();
  });
});

import { addressChanged } from './wp-ingest.service.js';

describe('addressChanged (desk address edit detection)', () => {
  const known = ['QA Flat 12, Lucknow', 'QA Flat 12, Gomti Nagar, Lucknow'];
  it('does not flag the website echo of an address the app itself sent', () => {
    expect(addressChanged(known, 'QA Flat 12, Gomti Nagar, Lucknow')).toBe(false);
    expect(addressChanged(known, 'qa flat 12,  gomti nagar,  LUCKNOW')).toBe(false);
  });
  it('flags a genuinely different address typed on the desk', () => {
    expect(addressChanged(known, 'Plot 9, Aliganj, Lucknow')).toBe(true);
  });
  it('ignores an empty website address', () => {
    expect(addressChanged(known, '')).toBe(false);
  });
});
