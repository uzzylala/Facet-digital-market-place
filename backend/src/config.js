import "dotenv/config";

function required(name){
    const value = process.env[name];
    if(!value) throw new Error(`Missing required environment variable ${name} (see backend/.env.example)`);
    return value;
}

export const config = {
    port: Number(process.env.PORT ?? 4000),
    clientOrigin: process.env.CLIENT_URL ?? "http://localhost:5173",
    databaseUrl: required('DATABASE_URL'),
    neonAuthUrl: required("NEON_AUTH_URL").replace(/\/$/, ''),
    s3:{
        endpoint: required('AWS_ENDPOINT_URL_S3'),
        region: process.env.AWS_REGION ?? "us-east-2",
        accessKeyId: required('AWS_ACCESS_KEY_ID'),
        secretAccessKey: required('AWS_SECRET_ACCESS_KEY'),
        bucket: process.env.S3_BUCKET ?? 'facet-marketplace'
    },
    stripe:{
        secretKey: process.env.STRIPE_SECRET_KEY ?? null,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? null,
    },
    gemini:{
        apiKey: process.env.GEMINI_API_KEY ?? null,
        model: process.env.GEMINI_MODE ?? "gemini-3.8-flash",
        fallbackModel: process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3.6-flash",
    }
}