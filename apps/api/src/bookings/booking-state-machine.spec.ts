import {
  canTransitionGrooming,
  canTransitionWalking,
  assertGroomingTransition,
  assertWalkingTransition,
} from './booking-state-machine.js';

describe('Grooming Booking State Machine', () => {
  it('allows valid grooming transitions', () => {
    expect(canTransitionGrooming('draft', 'pending_payment')).toBe(true);
    expect(canTransitionGrooming('pending_payment', 'confirmed')).toBe(true);
    expect(canTransitionGrooming('confirmed', 'needs_partner')).toBe(true);
    expect(canTransitionGrooming('needs_partner', 'assigned')).toBe(true);
    expect(canTransitionGrooming('assigned', 'partner_on_the_way')).toBe(true);
    expect(canTransitionGrooming('arrived', 'in_progress')).toBe(true);
    expect(canTransitionGrooming('in_progress', 'completed')).toBe(true);
  });

  it('rejects invalid grooming transitions', () => {
    expect(canTransitionGrooming('completed', 'in_progress')).toBe(false);
    expect(canTransitionGrooming('cancelled', 'confirmed')).toBe(false);
    expect(canTransitionGrooming('draft', 'completed')).toBe(false);
    expect(canTransitionGrooming('in_progress', 'pending_payment')).toBe(false);
  });

  it('allows cancellation from various states', () => {
    expect(canTransitionGrooming('draft', 'cancelled')).toBe(true);
    expect(canTransitionGrooming('confirmed', 'cancelled')).toBe(true);
    expect(canTransitionGrooming('assigned', 'cancelled')).toBe(true);
    expect(canTransitionGrooming('in_progress', 'cancelled')).toBe(true);
  });

  it('throws on invalid grooming transition assertion', () => {
    expect(() => assertGroomingTransition('completed', 'draft')).toThrow();
  });
});

describe('Walking Booking State Machine', () => {
  it('allows valid walking transitions', () => {
    expect(canTransitionWalking('draft', 'searching_partner')).toBe(true);
    expect(canTransitionWalking('searching_partner', 'accepted')).toBe(true);
    expect(canTransitionWalking('accepted', 'partner_on_the_way')).toBe(true);
    expect(canTransitionWalking('in_progress', 'completed')).toBe(true);
  });

  it('allows expiry from searching_partner', () => {
    expect(canTransitionWalking('searching_partner', 'expired')).toBe(true);
  });

  it('rejects invalid walking transitions', () => {
    expect(canTransitionWalking('completed', 'in_progress')).toBe(false);
    expect(canTransitionWalking('expired', 'accepted')).toBe(false);
  });

  it('throws on invalid walking transition assertion', () => {
    expect(() => assertWalkingTransition('completed', 'searching_partner')).toThrow();
  });
});
