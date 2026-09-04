import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  SMS_PROVIDER: z.enum(['mock', 'twilio']).default('mock'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),

  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().default('wagandtails-dev'),
  STORAGE_LOCAL_PATH: z.string().default('./uploads'),

  PAYMENT_PROVIDER: z.enum(['mock', 'razorpay']).default('mock'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),

  MAPS_PROVIDER: z.enum(['mock', 'google', 'mapbox']).default('mock'),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  MAPBOX_TOKEN: z.string().optional(),

  PUSH_PROVIDER: z.enum(['mock', 'fcm']).default('mock'),
  FCM_SERVER_KEY: z.string().optional(),

  LLM_PROVIDER: z.enum(['mock', 'openai', 'anthropic']).default('mock'),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  EMAIL_PROVIDER: z.enum(['mock', 'sendgrid']).default('mock'),
  SENDGRID_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().email().default('hello@wagandtails.in'),

  API_PORT: z.coerce.number().default(3001),
  API_URL: z.string().url().default('http://localhost:3001'),
  CORS_ORIGINS: z.string().default('http://localhost:3002,http://localhost:3003,http://localhost:3004'),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | undefined;

export function getEnv(): Env {
  if (!_env) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
      throw new Error('Invalid environment configuration');
    }
    _env = parsed.data;
  }
  return _env;
}

// Business configuration constants
export const BUSINESS_CONFIG = {
  FREE_CANCELLATION_HOURS: 4,
  PLATFORM_COMMISSION_RATE: 0.20, // 20%
  MIN_WALK_RADIUS_KM: 1,
  MAX_WALK_RADIUS_KM: 15,
  WALK_REQUEST_EXPIRY_SECONDS: 45,
  MAX_WALK_REQUEST_RETRIES: 3,
  OTP_EXPIRY_MINUTES: 10,
  OTP_LENGTH: 6,
  MAX_PETS_PER_CUSTOMER: 10,
  MAX_ADDRESSES_PER_CUSTOMER: 5,
  MAX_PHOTOS_PER_JOB: 10,
  BOOKING_CONFIRMATION_WINDOW_MINUTES: 30,
} as const;
