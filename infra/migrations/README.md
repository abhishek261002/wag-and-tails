# Migrations

Database migrations are managed by **Prisma Migrate**.

## Commands

```bash
# Apply all pending migrations (CI / production)
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma

# Create a new migration (development)
npx prisma migrate dev --name <description> --schema=apps/api/prisma/schema.prisma

# Reset the database and re-apply all migrations (dev only — destructive!)
npx prisma migrate reset --schema=apps/api/prisma/schema.prisma

# Open Prisma Studio (visual DB browser)
npx prisma studio --schema=apps/api/prisma/schema.prisma
```

## First-time setup

1. Ensure PostgreSQL is running with the PostGIS extension enabled.
2. Set `DATABASE_URL` in your `.env`.
3. Run `npx prisma migrate dev --name init` to create the initial migration.
4. Run `npx prisma db seed` to populate seed data.

> The `init-db.sql` in `infra/docker/` enables PostGIS and uuid-ossp automatically
> when the Docker Compose Postgres container starts for the first time.
