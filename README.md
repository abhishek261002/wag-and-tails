# 🐾 Wag & Tails

A production-ready pet grooming, dog walking, and pet products platform. Four surfaces, one monorepo.

| Surface | Tech | Port |
|---|---|---|
| Customer mobile app | React Native + Expo | — |
| Partner mobile app | React Native + Expo | — |
| Staff portal | React + Vite | 3003 |
| Admin console | React + Vite | 3004 |
| API | NestJS + Fastify | 3001 |
| PostgreSQL | PostGIS 16 | 5432 |
| Redis | Redis 7 | 6379 |

---

## Prerequisites

| Tool | Minimum version |
|---|---|
| Node.js | 20.x |
| npm | 10.x |
| Docker Desktop | 4.x |
| Expo CLI | `npm i -g expo-cli` |
| Android Studio / Xcode | For mobile simulators |

---

## Quick Start (local development)

### 1. Clone and install

```bash
git clone https://github.com/your-org/wag-and-tails.git
cd wag-and-tails
npm install
```

### 2. Copy environment variables

```bash
cp .env.example .env
```

The defaults in `.env.example` work out of the box for local development.
All external providers (payments, maps, LLM, push, SMS) run in **mock mode** by default —
no API keys are required to run the app locally.

### 3. Start infrastructure (PostgreSQL + Redis)

```bash
# Starts only the database and Redis — run apps locally for hot reload
docker compose -f infra/docker/docker-compose.dev.yml up -d
```

Wait for both containers to be healthy:

```bash
docker compose -f infra/docker/docker-compose.dev.yml ps
```

### 4. Run database migrations

```bash
cd apps/api
npx prisma migrate dev --name init
```

> First run only. This creates all 45+ tables with PostGIS support.

### 5. Seed the database

```bash
npm run db:seed --workspace=@wag/api
```

This creates:
- **Admin** — `admin@wagandtails.in` / `WagTails@123`
- **Staff** — `staff@wagandtails.in` / `WagTails@123`
- **Customers** — Arjun (Simba 🐕), Sahana (Mochi 🐩), Rohan (Rio 🐶)
- **Partners** — Ritika Sharma (grooming), Aman Verma (both), Neha Pillai (grooming), Karan Joshi (walking)
- Grooming packages, add-ons, walk pricing, 10 store products, 4 coupons
- Sample bookings with full status history and reviews

### 6. Start the API

```bash
# From repo root
npm run dev --workspace=@wag/api

# Or directly
cd apps/api && npm run dev
```

API available at **http://localhost:3001/api/v1**
Swagger docs at **http://localhost:3001/api/docs**

### 7. Start the web consoles

Open two terminals:

```bash
# Staff portal — http://localhost:3003
npm run dev --workspace=@wag/staff-web

# Admin console — http://localhost:3004
npm run dev --workspace=@wag/admin-web
```

### 8. Run the mobile apps

```bash
# Customer app
cd apps/customer-mobile
npx expo start

# Partner app (separate terminal)
cd apps/partner-mobile
npx expo start
```

Scan the QR code with **Expo Go** on your phone, or press:
- `a` — Android emulator
- `i` — iOS simulator

---

## App URLs at a glance

| App | URL / Command |
|---|---|
| API | http://localhost:3001/api/v1 |
| Swagger | http://localhost:3001/api/docs |
| Staff portal | http://localhost:3003 |
| Admin console | http://localhost:3004 |
| pgAdmin (optional) | http://localhost:5050 |
| Prisma Studio | `npm run db:studio --workspace=@wag/api` |

---

## Test accounts

| Role | Email | Password | Notes |
|---|---|---|---|
| Super Admin | admin@wagandtails.in | WagTails@123 | Admin console |
| Staff | staff@wagandtails.in | WagTails@123 | Staff portal |
| Partner (grooming) | ritika.sharma@wagpartner.in | Partner@123 | Partner app |
| Partner (walking) | karan.joshi@wagpartner.in | Partner@123 | Partner app |
| Partner (both) | aman.verma@wagpartner.in | Partner@123 | Partner app |
| Customer | +919876543210 | OTP via phone | Customer app — Arjun / Simba |
| Customer | +919876543211 | OTP via phone | Customer app — Sahana / Mochi |
| Customer | +919876543212 | OTP via phone | Customer app — Rohan / Rio |

> **Mock OTP** — In development, the API logs the OTP to the console and also returns it in the `/auth/otp/request` response body for easy testing. Look for `[MOCK OTP]` in the API logs.

---

## Project structure

```
wag-and-tails/
  apps/
    api/                   NestJS backend (all modules)
    customer-mobile/       React Native / Expo — customer app
    partner-mobile/        React Native / Expo — partner app
    staff-web/             React + Vite — staff operations portal
    admin-web/             React + Vite — super admin console
  packages/
    design-tokens/         Brand colors, typography, spacing, shadows
    shared-types/          TypeScript domain models shared across all apps
    validation/            Zod schemas for API request/response validation
    config/                Environment variable validation + business constants
    api-client/            Typed Axios client with token refresh + all API methods
    ui-web/                Shared React components (Button, Table, Modal, KpiCard…)
    ui-mobile/             Shared RN components (Button, PetAvatar, SlideToComplete…)
  infra/
    docker/                Docker Compose files, Dockerfiles, nginx config
    migrations/            Migration docs + init SQL
    seed/                  (additional seed scripts if needed)
  docs/
```

---

## Running tests

```bash
# All tests (from root)
npm test

# API unit tests only
npm test --workspace=@wag/api

# Watch mode (API)
cd apps/api && npx jest --watch
```

Key test files:
- `apps/api/src/bookings/booking-state-machine.spec.ts` — all grooming + walking status transitions
- `apps/api/src/payouts/payouts.spec.ts` — payout commission calculations

---

## Useful development commands

```bash
# Start everything at once (API + staff + admin)
npm run dev:all

# Start individual surfaces
npm run dev:api      # http://localhost:3001
npm run dev:staff    # http://localhost:3003
npm run dev:admin    # http://localhost:3004
npm run dev:web      # staff + admin together

# Run typecheck + lint + tests + build (CI equivalent)
npm run check

# Typecheck all packages and apps
npm run typecheck

# Lint all packages
npm run lint

# Generate Prisma client after schema changes
cd apps/api && npx prisma generate

# Create a new migration after schema changes
cd apps/api && npx prisma migrate dev --name describe-your-change

# Open Prisma Studio (visual database browser)
npm run db:studio --workspace=@wag/api

# Reset database (drops all data, re-runs all migrations + seed)
cd apps/api && npx prisma migrate reset
```

---

## Environment variables

All variables are documented in `.env.example`. Key ones:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | postgresql://postgres:postgres@localhost:5432/wagandtails | Prisma connection string |
| `REDIS_URL` | redis://localhost:6379 | BullMQ + cache |
| `JWT_SECRET` | *(see .env.example)* | Must be 32+ chars. `.env.example` ships with a valid 32-char dev default |
| `PAYMENT_PROVIDER` | `mock` | Set to `razorpay` in production |
| `MAPS_PROVIDER` | `mock` | Set to `google` or `mapbox` in production |
| `LLM_PROVIDER` | `mock` | Set to `openai` or `anthropic` in production |
| `SMS_PROVIDER` | `mock` | Set to `twilio` in production |
| `PUSH_PROVIDER` | `mock` | Set to `fcm` in production |
| `STORAGE_PROVIDER` | `local` | Set to `s3` in production |

---

## Docker (full stack)

To run the entire stack in Docker (production mode):

```bash
# Copy and configure .env first
cp .env.example .env

# Build and start everything
docker compose -f infra/docker/docker-compose.yml up --build

# Stop everything
docker compose -f infra/docker/docker-compose.yml down
```

Services started:
- PostgreSQL + PostGIS on port 5432
- Redis on port 6379
- API on port 3001 (runs migrations automatically on startup)
- Staff portal on port 3003
- Admin console on port 3004

---

## Manual testing

A full manual test plan is at [`docs/manual-test-plan.md`](docs/manual-test-plan.md). It includes:
- Exact seeded login credentials and OTP instructions
- Step-by-step flows for all major customer, partner, staff, and admin scenarios
- Real-time cross-surface test checklist
- Mock provider behaviour reference
- Windows/Expo/Docker troubleshooting notes

---

## Architecture overview

### Backend (NestJS)

All modules follow the same pattern: `module → controller → service → prisma`.

Key modules:
- **AuthModule** — OTP phone login for customers, email/password for staff/admin, JWT + refresh token rotation
- **BookingsModule** — Core state machines for grooming (`draft → completed`) and walking (`draft → completed`)
- **PartnersModule** — Online/offline, open job matching with haversine distance, job claim, completion with checklist + photos
- **WalkingModule** — Live walk session, location point recording, search nearby partners via PostGIS-ready query
- **AiPetChatModule** — LLM gateway with pet context injection, off-topic guardrails, prompt injection protection
- **RealtimeGateway** — Socket.IO with user/role/booking rooms for live updates across all surfaces

### Database

PostgreSQL 16 + PostGIS. 50+ tables, managed by Prisma Migrate.
Key design decisions:
- Pet care notes are stored per-pet and **denormalised onto every booking** at creation time so the partner always sees the care context even if the owner later edits the note
- Booking status transitions are strictly enforced in `booking-state-machine.ts` before any DB write
- Partner location stored in `partner_locations` (upsert) and `walk_location_points` (append) separately — live location vs route history

### Realtime

Socket.IO gateway at `/realtime`. Clients join rooms:
- `user:<userId>` — personal notifications
- `role:<role>` — role-wide broadcasts (e.g. all staff see new bookings)
- `booking:<bookingId>` — status updates for a specific booking

### Payments

Payment provider is abstracted behind `PaymentProvider` interface. `MockPaymentProvider` always succeeds locally. Swap in `RazorpayProvider` by setting `PAYMENT_PROVIDER=razorpay` and providing keys.

### LLM Pet Chat

The AI service:
1. Verifies the customer owns the requested pet
2. Builds a sanitised pet context string from profile, care notes, vaccinations, allergies, and history
3. Applies a strict system prompt — the bot only answers pet-related questions
4. Blocks off-topic messages with regex guardrails before even calling the LLM
5. Treats all user input and pet notes as untrusted text — never as instructions

---

## Feature checklist

### Customer app
- [x] Phone OTP login + registration
- [x] Pet profiles with care notes, vaccinations, vet info
- [x] Grooming booking flow (9 steps: pet → package → add-ons → date → slot → address → notes → review → confirm)
- [x] Dog walking booking (now or schedule, partner search, live tracking)
- [x] Store with category browse, cart, checkout, allergy warnings
- [x] Booking management (reschedule, cancel, message, receipt)
- [x] AI pet persona chatbot with guardrails
- [x] Account, addresses, wallet, notifications

### Partner app
- [x] Grooming/Walking mode switch
- [x] Online/offline toggle
- [x] Open jobs list with claim
- [x] Job detail — pet info, care notes, checklist, photo upload, payout
- [x] SlideToComplete walk ending gesture
- [x] Earnings dashboard + payout request
- [x] Schedule view grouped by day
- [x] Partner store at trade pricing

### Staff portal
- [x] Dashboard with 6 KPIs + attention banner
- [x] All bookings table with care notes preview
- [x] Booking detail — assign/unassign/reassign partner, cancel, copy confirmation text
- [x] Create booking for off-app channels (WhatsApp, phone, Instagram, walk-in)
- [x] Store orders — pack, print label, call customer
- [x] Customer and partner views

### Admin console
- [x] Revenue dashboard with channel split, top packages, best sellers
- [x] Partner approval / suspension workflow
- [x] Payout batch management with multi-select
- [x] Full coupon CRUD with all rules
- [x] Grooming package and add-on management
- [x] Walk pricing editor
- [x] Product catalogue management (retail + trade prices)
- [x] Staff user creation
- [x] Audit log

### Infrastructure
- [x] Docker Compose (dev + production)
- [x] Prisma schema with PostGIS
- [x] Seed data matching prototype (Simba, Mochi, Rio + 4 partners)
- [x] Mock providers for all external services
- [x] Health endpoint
- [x] JWT + refresh token rotation
- [x] Role-based access control on every API route

---

## Contributing

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Make changes and run `npm run typecheck` + `npm test`
3. Commit with a descriptive message
4. Open a pull request

---

## License

Private — © Wag & Tails. All rights reserved.
