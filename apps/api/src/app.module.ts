import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthController } from './health/health.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { PetsModule } from './pets/pets.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { GroomingModule } from './grooming/grooming.module.js';
import { WalkingModule } from './walking/walking.module.js';
import { PartnersModule } from './partners/partners.module.js';
import { StoreModule } from './store/store.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { PayoutsModule } from './payouts/payouts.module.js';
import { CouponsModule } from './coupons/coupons.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { MapsLocationModule } from './maps-location/maps-location.module.js';
import { AiPetChatModule } from './ai-pet-chat/ai-pet-chat.module.js';
import { FilesModule } from './files/files.module.js';
import { StaffModule } from './staff/staff.module.js';
import { AdminModule } from './admin/admin.module.js';
import { AuditLogModule } from './audit-log/audit-log.module.js';
import { RealtimeGateway } from './realtime/realtime.gateway.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    BullModule.forRoot({
      redis: process.env['REDIS_URL']
        ? process.env['REDIS_URL']
        : { host: 'localhost', port: 6379 },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    PetsModule,
    BookingsModule,
    GroomingModule,
    WalkingModule,
    PartnersModule,
    StoreModule,
    OrdersModule,
    PaymentsModule,
    PayoutsModule,
    CouponsModule,
    MessagingModule,
    NotificationsModule,
    MapsLocationModule,
    AiPetChatModule,
    FilesModule,
    StaffModule,
    AdminModule,
    AuditLogModule,
  ],
  providers: [RealtimeGateway],
  controllers: [HealthController],
})
export class AppModule {}
