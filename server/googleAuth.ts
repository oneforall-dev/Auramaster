import crypto from 'crypto';
import { storage, UserProfile } from './storage';

const SESSION_SECRET = process.env.SESSION_SECRET || 'auramaster_vps_session_secret_jwt_2026_secure';

export interface AuthSession {
  userId: string;
  email: string;
  name: string;
  picture?: string;
  expiresAt: number;
}

/**
 * Creates a tamper-proof signed session token for a user.
 */
export function createSessionToken(user: UserProfile, expiresInHours = 24 * 7): string {
  const expiresAt = Date.now() + expiresInHours * 60 * 60 * 1000;
  const payload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    expiresAt
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

/**
 * Verifies and decodes a signed session token.
 */
export function verifySessionToken(token: string): AuthSession | null {
  try {
    if (!token || !token.includes('.')) return null;
    const [payloadBase64, signature] = token.split('.');
    
    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(payloadBase64)
      .digest('base64url');

    if (signature !== expectedSig) {
      return null;
    }

    const payload: AuthSession = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
    if (Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch (e) {
    return null;
  }
}

/**
 * Verifies a Google OAuth ID Token using Google's public tokeninfo endpoint.
 */
export async function verifyGoogleIdToken(idToken: string, meta?: { ip?: string; userAgent?: string }): Promise<UserProfile | null> {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!res.ok) {
      console.warn('[GoogleAuth] Token verification failed with status:', res.status);
      return null;
    }

    const data: any = await res.json();
    if (!data.sub || !data.email) {
      return null;
    }

    const user: UserProfile = {
      id: `google_${data.sub}`,
      email: data.email,
      name: data.name || data.email.split('@')[0],
      picture: data.picture,
      role: 'user',
      createdAt: Date.now(),
      lastLogin: Date.now(),
      provider: 'Google OAuth'
    };

    return storage.upsertUser(user, meta);
  } catch (e) {
    console.error('[GoogleAuth] Error verifying token with Google:', e);
    return null;
  }
}

/**
 * Exchanges an OAuth 2.0 Authorization Code with Google using Client Secret.
 */
export async function exchangeGoogleAuthCode(code: string, redirectUri: string, meta?: { ip?: string; userAgent?: string }): Promise<UserProfile | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('[GoogleAuth] Token exchange failed:', err);
      return null;
    }

    const tokenData: any = await tokenRes.json();
    if (tokenData.id_token) {
      return await verifyGoogleIdToken(tokenData.id_token, meta);
    }
    return null;
  } catch (e) {
    console.error('[GoogleAuth] Error exchanging code:', e);
    return null;
  }
}

/**
 * Helper for development / testing login mode.
 */
export function createDevUser(email = 'studio.engineer@auramaster.ai', name = 'Audio Engineer', meta?: { ip?: string; userAgent?: string }): UserProfile {
  const user: UserProfile = {
    id: `google_dev_${crypto.createHash('md5').update(email).digest('hex').slice(0, 12)}`,
    email,
    name,
    picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    role: 'user',
    createdAt: Date.now(),
    lastLogin: Date.now(),
    provider: 'Studio Demo'
  };
  return storage.upsertUser(user, meta);
}
