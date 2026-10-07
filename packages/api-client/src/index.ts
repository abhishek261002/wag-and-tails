export { ApiClient, extractTokens } from './client';
export type { ApiClientConfig, ApiError } from './client';
export { AuthApi } from './auth.api';
export { PetsApi } from './pets.api';
export type { GroomingHistoryEntry } from './pets.api';
export { BookingsApi } from './bookings.api';
export type { PaginatedResponse, BookingFilters, AvailableCoupon } from './bookings.api';
export { StoreApi } from './store.api';
export { PartnerApi } from './partner.api';
export type { ToolMedia, ToolsResponse } from './partner.api';
export { MessagingApi } from './messaging.api';
export { AiApi } from './ai.api';
export { PaymentsApi } from './payments.api';
export { SupportApi } from './support.api';
export type { SupportTicket, SupportMessage } from './support.api';
export { MapsApi } from './maps.api';
export { UsersApi } from './users.api';
export type { ProfileUpdate } from './users.api';
export type { PlaceSuggestion, PlaceDetails } from './maps.api';
export { InsuranceApi } from './insurance.api';
export type { MyInsuranceRequest, InsuranceList } from './insurance.api';
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
import { PaymentsApi } from './payments.api';
import { SupportApi } from './support.api';
import { MapsApi } from './maps.api';
import { UsersApi } from './users.api';
import { InsuranceApi } from './insurance.api';
import { RealtimeClient } from './realtime';
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
    payments: new PaymentsApi(client),
    support: new SupportApi(client),
    maps: new MapsApi(client),
    users: new UsersApi(client),
    insurance: new InsuranceApi(client),
    realtime: new RealtimeClient(config.baseURL, config.getAccessToken),
  };
}

export type WagApiClient = ReturnType<typeof createWagApiClient>;