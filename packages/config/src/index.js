"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUSINESS_CONFIG = void 0;
exports.getEnv = getEnv;
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: zod_1.z.string().url(),
    REDIS_URL: zod_1.z.string().url(),
    JWT_SECRET: zod_1.z.string().min(32),
    JWT_REFRESH_SECRET: zod_1.z.string().min(32),
    JWT_EXPIRES_IN: zod_1.z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: zod_1.z.string().default('30d'),
    SMS_PROVIDER: zod_1.z.enum(['mock', 'twilio']).default('mock'),
    TWILIO_ACCOUNT_SID: zod_1.z.string().optional(),
    TWILIO_AUTH_TOKEN: zod_1.z.string().optional(),
    TWILIO_FROM_NUMBER: zod_1.z.string().optional(),
    STORAGE_PROVIDER: zod_1.z.enum(['local', 's3']).default('local'),
    AWS_REGION: zod_1.z.string().default('ap-south-1'),
    AWS_ACCESS_KEY_ID: zod_1.z.string().optional(),
    AWS_SECRET_ACCESS_KEY: zod_1.z.string().optional(),
    AWS_S3_BUCKET: zod_1.z.string().default('wagandtails-dev'),
    STORAGE_LOCAL_PATH: zod_1.z.string().default('./uploads'),
    PAYMENT_PROVIDER: zod_1.z.enum(['mock', 'razorpay']).default('mock'),
    RAZORPAY_KEY_ID: zod_1.z.string().optional(),
    RAZORPAY_KEY_SECRET: zod_1.z.string().optional(),
    MAPS_PROVIDER: zod_1.z.enum(['mock', 'google', 'mapbox']).default('mock'),
    GOOGLE_MAPS_API_KEY: zod_1.z.string().optional(),
    MAPBOX_TOKEN: zod_1.z.string().optional(),
    PUSH_PROVIDER: zod_1.z.enum(['mock', 'fcm']).default('mock'),
    FCM_SERVER_KEY: zod_1.z.string().optional(),
    LLM_PROVIDER: zod_1.z.enum(['mock', 'openai', 'anthropic']).default('mock'),
    OPENAI_API_KEY: zod_1.z.string().optional(),
    ANTHROPIC_API_KEY: zod_1.z.string().optional(),
    EMAIL_PROVIDER: zod_1.z.enum(['mock', 'sendgrid']).default('mock'),
    SENDGRID_API_KEY: zod_1.z.string().optional(),
    FROM_EMAIL: zod_1.z.string().email().default('hello@wagandtails.in'),
    API_PORT: zod_1.z.coerce.number().default(3001),
    API_URL: zod_1.z.string().url().default('http://localhost:3001'),
    CORS_ORIGINS: zod_1.z.string().default('http://localhost:3002,http://localhost:3003,http://localhost:3004'),
});
let _env;
function getEnv() {
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
exports.BUSINESS_CONFIG = {
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
};
//# sourceMappingURL=index.js.map