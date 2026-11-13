// ── REAL ── uncomment when going live: Neon Auth (Managed Better Auth)
import { createAuthClient } from '@neondatabase/auth';
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters';

const AUTH_URL = import.meta.env.VITE_NEON_AUTH_URL;

if (!AUTH_URL) {
  console.warn('VITE_NEON_AUTH_URL is not set — sign-in will not work. See .env.example.');
}

export const authClient = createAuthClient(AUTH_URL ?? 'http://localhost/missing-neon-auth-url', {
  adapter: BetterAuthReactAdapter(),
});

export async function getAccessToken() {
  try {
    const { data } = await authClient.getSession();
    return data?.session?.token ?? null;
  } catch {
    return null;
  }
}

