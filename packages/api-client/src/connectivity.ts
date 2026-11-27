// Tells the apps whether the server can be reached, without a native network module.
// Any request that gets no answer marks us offline; any answer marks us online again. While offline we ping the
// health endpoint so the notice clears by itself when the connection returns, even if no screen makes a request.
const PING_MS = 5000;

let offline = false;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function set(next: boolean): void {
  if (next === offline) return;
  offline = next;
  if (!next && timer) {
    clearInterval(timer);
    timer = null;
  }
  listeners.forEach((listener) => listener());
}

export const connectivity = {
  isOffline: (): boolean => offline,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  reached(): void {
    set(false);
  },
  unreachable(pingUrl: string): void {
    set(true);
    if (!timer) {
      timer = setInterval(() => {
        fetch(pingUrl).then(() => set(false)).catch(() => {});
      }, PING_MS);
    }
  },
};
