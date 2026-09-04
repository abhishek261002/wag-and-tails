export { ApiClient } from './client.js';
export type { ApiClientConfig, ApiError } from './client.js';
export { AuthApi } from './auth.api.js';
export { PetsApi } from './pets.api.js';
export { BookingsApi } from './bookings.api.js';
export type { PaginatedResponse, BookingFilters } from './bookings.api.js';
export { StoreApi } from './store.api.js';
export { PartnerApi } from './partner.api.js';
export { MessagingApi } from './messaging.api.js';
export { AiApi } from './ai.api.js';
export { RealtimeClient } from './realtime.js';

// Convenience factory
import { ApiClient } from './client.js';
import { AuthApi } from './auth.api.js';
import { PetsApi } from './pets.api.js';
import { BookingsApi } from './bookings.api.js';
import { StoreApi } from './store.api.js';
import { PartnerApi } from './partner.api.js';
import { MessagingApi } from './messaging.api.js';
import { AiApi } from './ai.api.js';
import type { ApiClientConfig } from './client.js';

export function createWagApiClient(config: ApiClientConfig) {
  const client = new ApiClient(config);
  return {
    client,
    auth: new AuthApi(client),
    pets: new PetsApi(client),
    bookings: new BookingsApi(client),
    store: new StoreApi(client),
    partner: new PartnerApi(client),
    messaging: new MessagingApi(client),
    ai: new AiApi(client),
  };
}

export type WagApiClient = ReturnType<typeof createWagApiClient>;
