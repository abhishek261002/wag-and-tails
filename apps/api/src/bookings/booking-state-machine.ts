import { BadRequestException } from '@nestjs/common';

// Grooming booking status transitions
export const GROOMING_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending_payment', 'cancelled'],
  pending_payment: ['confirmed', 'cancelled'],
  confirmed: ['needs_partner', 'cancelled'],
  needs_partner: ['assigned', 'cancelled'],
  assigned: ['partner_on_the_way', 'needs_partner', 'cancelled'],
  partner_on_the_way: ['arrived', 'needs_partner'],
  arrived: ['in_progress'],
  in_progress: ['completed', 'cancelled'],
  completed: ['refunded'],
  cancelled: ['refunded'],
  refunded: [],
};

// Walking booking status transitions
// Scheduled (non-instant) walks are created as 'confirmed' and are dispatched like grooming
// jobs (needs_partner -> assigned), so they need those states too; instant walks use
// searching_partner -> accepted.
export const WALKING_TRANSITIONS: Record<string, string[]> = {
  draft: ['searching_partner', 'cancelled'],
  confirmed: ['needs_partner', 'assigned', 'cancelled'],
  needs_partner: ['assigned', 'cancelled'],
  assigned: ['partner_on_the_way', 'needs_partner', 'cancelled'],
  searching_partner: ['accepted', 'cancelled', 'expired'],
  accepted: ['partner_on_the_way', 'cancelled'],
  partner_on_the_way: ['arrived', 'needs_partner'],
  arrived: ['in_progress'],
  in_progress: ['completed'],
  completed: ['refunded'],
  cancelled: ['refunded'],
  expired: [],
  refunded: [],
};

export function canTransitionGrooming(from: string, to: string): boolean {
  return (GROOMING_TRANSITIONS[from] ?? []).includes(to);
}

export function canTransitionWalking(from: string, to: string): boolean {
  return (WALKING_TRANSITIONS[from] ?? []).includes(to);
}

export function assertGroomingTransition(from: string, to: string): void {
  if (!canTransitionGrooming(from, to)) {
    throw new BadRequestException(`Invalid grooming booking transition: ${from} → ${to}`);
  }
}

export function assertWalkingTransition(from: string, to: string): void {
  if (!canTransitionWalking(from, to)) {
    throw new BadRequestException(`Invalid walking booking transition: ${from} → ${to}`);
  }
}
