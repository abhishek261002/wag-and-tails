-- Run once on first database startup
-- Enables PostGIS and uuid-ossp extensions needed by Prisma schema

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
