import { Global, Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { RoutingModule } from '../routing/routing.module.js';
import { WpClientService } from './wp-client.service.js';
import { WpConfigSyncService } from './wp-config-sync.service.js';
import { WpOutboxService } from './wp-outbox.service.js';
import { WpJobsService } from './wp-jobs.service.js';
import { WpIngestService } from './wp-ingest.service.js';
import { WpBookingsService } from './wp-bookings.service.js';
import { WpDeskService } from './wp-desk.service.js';
import { WpStoreService } from './wp-store.service.js';
import { WpController } from './wp.controller.js';
import { WpConnectorController } from './wp-connector.controller.js';
import { WpCustomerController } from './wp-customer.controller.js';
import { TrackController } from './track.controller.js';

// Link to the client's WordPress plugin (bookings desk, cities, prices). Global so bookings, grooming, partners and
// payments can use it without import cycles; services that need those modules reach them lazily through ModuleRef.
@Global()
@Module({
  imports: [RealtimeModule, NotificationsModule, RoutingModule],
  providers: [WpClientService, WpConfigSyncService, WpOutboxService, WpJobsService, WpIngestService, WpBookingsService, WpDeskService, WpStoreService],
  controllers: [WpController, WpConnectorController, WpCustomerController, TrackController],
  exports: [WpClientService, WpConfigSyncService, WpOutboxService, WpJobsService, WpIngestService, WpBookingsService, WpStoreService],
})
export class WpModule {}
