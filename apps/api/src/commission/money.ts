// Money helpers. Amounts are handled in integer paise so percentages never accumulate float error.
export const toPaise = (inr: number | string | { toString(): string }) => Math.round(Number(inr.toString()) * 100);
export const fromPaise = (paise: number) => paise / 100;

/** Rounds half up on paise, e.g. 15% of ₹999.99. */
export const percentOf = (paise: number, pct: number) => Math.round((paise * pct) / 100);

export interface PriceBreakdown {
  subtotal: number;
  couponDiscount: number;
  partnerDiscountPct: number | null;
  partnerDiscountAmount: number;
  discount: number;
  discountSource: 'coupon' | 'partner' | null;
  total: number;
  commissionPct: number;
  commissionAmount: number;
  partnerShareAmount: number;
}

/**
 * The price a customer pays once a specific partner has claimed the job, and how it splits.
 * A partner discount and a coupon are never stacked: whichever gives the customer more wins.
 * The commission is taken on what the customer actually pays, so the discount is shared proportionally.
 */
export function priceBooking(input: {
  subtotal: number;
  couponDiscount: number;
  partnerDiscountPct: number | null;
  commissionPct: number;
}): PriceBreakdown {
  const sub = toPaise(input.subtotal);
  const coupon = Math.min(toPaise(input.couponDiscount), sub);
  const pd = input.partnerDiscountPct && input.partnerDiscountPct > 0 ? percentOf(sub, input.partnerDiscountPct) : 0;
  const partnerWins = pd > coupon;
  const discount = partnerWins ? pd : coupon;
  const total = sub - discount;
  const commission = percentOf(total, input.commissionPct);
  return {
    subtotal: fromPaise(sub),
    couponDiscount: fromPaise(coupon),
    partnerDiscountPct: input.partnerDiscountPct ?? null,
    partnerDiscountAmount: fromPaise(pd),
    discount: fromPaise(discount),
    discountSource: discount === 0 ? null : partnerWins ? 'partner' : 'coupon',
    total: fromPaise(total),
    commissionPct: input.commissionPct,
    commissionAmount: fromPaise(commission),
    partnerShareAmount: fromPaise(total - commission),
  };
}
