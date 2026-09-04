# Wag & Tails — Architecture

## System diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Client surfaces                            │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐                        │
│  │  Customer Mobile │  │  Partner Mobile  │  React Native / Expo   │
│  │  (customer-mobile│  │  (partner-mobile)│                        │
│  └────────┬─────────┘  └────────┬─────────┘                        │
│           │                     │                                   │
│  ┌──────────────────┐  ┌──────────────────┐                        │
│  │   Staff Portal   │  │  Admin Console   │  React / Vite          │
│  │   (staff-web)    │  │  (admin-web)     │                        │
│  └────────┬─────────┘  └────────┬─────────┘                        │
└───────────┼─────────────────────┼───────────────────────────────────┘
            │   REST + WebSocket  │
            ▼                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        NestJS API (apps/api)                        │
│                                                                     │
│  AuthModule  PetsModule  BookingsModule  GroomingModule             │
│  WalkingModule  PartnersModule  StoreModule  OrdersModule           │
│  PaymentsModule  PayoutsModule  CouponsModule  MessagingModule      │
│  NotificationsModule  MapsLocationModule  AiPetChatModule           │
│  FilesModule  StaffModule  AdminModule  AuditLogModule              │
│                                                                     │
│  RealtimeGateway (Socket.IO)  HealthController                      │
└──────────┬────────────────────┬────────────────┬─────────────────────┘
           │                    │                │
    ┌──────▼──────┐    ┌────────▼──────┐  ┌─────▼──────┐
    │ PostgreSQL  │    │     Redis     │  │  Uploads   │
    │ + PostGIS   │    │  (BullMQ +    │  │  (local /  │
    │             │    │   cache)      │  │   S3)      │
    └─────────────┘    └───────────────┘  └────────────┘
```

## Request flow — Grooming booking

```
Customer app
  → POST /bookings/grooming
    → BookingsService.createGroomingBooking()
      → validate pet ownership
      → load package + add-ons
      → apply coupon (CouponsService)
      → denormalise pet care notes onto booking record
      → create booking (status: pending_payment)
      → create BookingStatusHistory record
    ← returns GroomingBooking
  → payment confirmed
    → PATCH /payments/:id/confirm
      → PaymentsService.confirmPayment()
        → update booking status → confirmed
        → update booking status → needs_partner
  Staff portal sees booking in "Needs Partner" queue
  → PATCH /staff/bookings/:id/assign { partnerId }
    → StaffService.assignPartner()
      → booking status → assigned
      → RealtimeGateway emits booking:status_changed to partner room
  Partner app receives Socket.IO event
  → job appears in "My Jobs" tab
```

## Care notes data flow

Care notes entered by a customer travel to every surface:

```
Customer adds note (POST /pets/:id/care-notes)
  → stored in pet_care_notes table

At booking creation time:
  → latest care note is read from pet_care_notes
  → denormalised onto bookings.pet_care_notes (snapshot)

The snapshot is shown on:
  ✓ Customer booking detail screen
  ✓ Staff booking detail page (highlighted in amber)
  ✓ Partner job card (shown prominently with 📝 icon)
  ✓ Admin booking table (truncated preview column)
  ✓ AI pet chat context (injected as sanitised text — not instructions)
```

## State machines

### Grooming booking
```
draft → pending_payment → confirmed → needs_partner → assigned
                                                      ↓
                                             partner_on_the_way → arrived → in_progress → completed
Any state (except completed/refunded) → cancelled → refunded
```

### Walking booking
```
draft → searching_partner → accepted → partner_on_the_way → arrived → in_progress → completed
     → expired (request timeout)
Any active state → cancelled → refunded
```

### Store order
```
placed → packed → out_for_delivery → delivered
Any → cancelled → refunded
```

### Payout
```
pending → requested → approved → processing → paid
                                             → failed
```

## Provider abstractions

All external integrations have a local mock that works without any API key.
Swap providers via environment variables:

| Concern | Env var | Mock → Production |
|---|---|---|
| Payments | `PAYMENT_PROVIDER` | `mock` → `razorpay` |
| Maps | `MAPS_PROVIDER` | `mock` → `google` / `mapbox` |
| LLM | `LLM_PROVIDER` | `mock` → `openai` / `anthropic` |
| SMS / OTP | `SMS_PROVIDER` | `mock` → `twilio` |
| Push | `PUSH_PROVIDER` | `mock` → `fcm` |
| Storage | `STORAGE_PROVIDER` | `local` → `s3` |

## Security notes

- JWT access tokens expire in 15 minutes; refresh tokens in 30 days with rotation on use
- All API routes require authentication except `/auth/*` and `/health`
- Every route enforces role-based access via `RolesGuard`
- AI pet chat: user input and pet notes are **treated as untrusted data** — regex guardrails block off-topic messages before LLM call; system prompt is never derived from user input
- OTP tokens are single-use and expire in 10 minutes
- Passwords are hashed with bcrypt (cost factor 12)
