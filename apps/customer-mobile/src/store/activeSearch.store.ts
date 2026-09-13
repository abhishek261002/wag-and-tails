import { create } from 'zustand';

export type SearchPhase = 'searching' | 'found' | 'expired';

interface ActiveSearchState {
  bookingId: string | null;
  petName: string | null;
  phase: SearchPhase;
  partnerName: string | null;
  start: (args: { bookingId: string; petName: string }) => void;
  markFound: (partnerName: string) => void;
  markExpired: () => void;
  dismiss: () => void;
}

// Backs the persistent search banner mounted once in app/_layout.tsx, so a
// customer who just booked a walk is never stuck on a full-screen loader —
// they're free to browse anywhere while this stays visible over every
// screen and updates itself as the booking's status changes.
export const useActiveSearchStore = create<ActiveSearchState>((set) => ({
  bookingId: null,
  petName: null,
  phase: 'searching',
  partnerName: null,

  start: ({ bookingId, petName }) => set({ bookingId, petName, phase: 'searching', partnerName: null }),
  markFound: (partnerName) => set({ phase: 'found', partnerName }),
  markExpired: () => set({ phase: 'expired' }),
  dismiss: () => set({ bookingId: null, petName: null, phase: 'searching', partnerName: null }),
}));
