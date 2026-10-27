import { create } from 'zustand';

/**
 * Hand-off from the History screen back to the chat screen underneath it: which chat to open, start a new one, or
 * which chat was deleted (so the open chat can be cleared if it was that one). The chat screen consumes it when it
 * comes back into view.
 */
export type DrWoofRequest =
  | { kind: 'open'; sessionId: string }
  | { kind: 'new' }
  | { kind: 'deleted'; sessionId: string };

interface DrWoofState {
  request: DrWoofRequest | null;
  send: (r: DrWoofRequest) => void;
  consume: () => DrWoofRequest | null;
}

export const useDrWoofStore = create<DrWoofState>((set, get) => ({
  request: null,
  send: (request) => set({ request }),
  consume: () => {
    const r = get().request;
    if (r) set({ request: null });
    return r;
  },
}));
