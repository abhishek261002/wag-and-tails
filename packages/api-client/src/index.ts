export { ApiClient } from './client';
export type { ApiClientConfig, ApiError } from './client';
export { AuthApi } from './auth.api';
export { PetsApi } from './pets.api';
export { BookingsApi } from './bookings.api';
export type { PaginatedResponse, BookingFilters } from './bookings.api';
export { StoreApi } from './store.api';
export { PartnerApi } from './partner.api';
export { MessagingApi } from './messaging.api';
export { AiApi } from './ai.api';
export { RealtimeClient } from './realtime';

// Convenience factory
import { ApiClient } from './client';
import { AuthApi } from './auth.api';
import { PetsApi } from './pets.api';
import { BookingsApi } from './bookings.api';
import { StoreApi } from './store.api';
import { PartnerApi } from './partner.api';
import { MessagingApi } from './messaging.api';
import { AiApi } from './ai.api';
import type { ApiClientConfig } from './client';

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