import { BUSINESS_CONFIG } from '@wag/config';

describe('Payout Calculation', () => {
  function calculatePayout(bookingTotal: number) {
    const gross = bookingTotal;
    const commission = Math.round(gross * BUSINESS_CONFIG.PLATFORM_COMMISSION_RATE);
    const net = gross - commission;
    return { gross, commission, net };
  }

  it('calculates 20% commission correctly', () => {
    const { gross, commission, net } = calculatePayout(1000);
    expect(gross).toBe(1000);
    expect(commission).toBe(200);
    expect(net).toBe(800);
  });

  it('calculates payout for standard grooming package', () => {
    const { net } = calculatePayout(999);
    expect(net).toBe(799); // 999 - 200 (rounded)
  });

  it('net + commission always equals gross', () => {
    const amounts = [249, 349, 449, 999, 1299, 1399, 1699, 2199];
    for (const amount of amounts) {
      const { gross, commission, net } = calculatePayout(amount);
      expect(net + commission).toBe(gross);
    }
  });
});
