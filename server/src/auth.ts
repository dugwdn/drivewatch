// Sign-in is a long random token per phone, made when the person creates a
// family or joins with an invite code. Only a hash of it is stored.

export interface Env {
  DB: D1Database;
  /** Shown on the support and privacy pages. */
  SUPPORT_EMAIL?: string;
  /** Workers rate limit binding for sign-ups (wrangler.toml [[ratelimits]]). */
  SIGNUP_LIMITER?: RateLimit;
  /** GA4 Measurement ID (wrangler.toml [vars]). Empty = no web tag and no screen counts sent to Google. */
  GA4_ID?: string;
  /** GA4 Measurement Protocol API secret (`wrangler secret put GA4_API_SECRET`). Empty = no screen counts sent. */
  GA4_API_SECRET?: string;
}

export interface Member {
  id: string;
  family_id: string;
  role: 'parent' | 'driver';
  name: string;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I

export function newId(): string {
  return crypto.randomUUID();
}

export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64url(bytes);
}

/** Six characters, easy to read out loud or type. */
export function newInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return base64url(new Uint8Array(digest));
}

export async function memberFromRequest(req: Request, env: Env): Promise<Member | null> {
  const header = req.headers.get('Authorization') ?? '';
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return null;
  const hash = await hashToken(match[1]);
  return env.DB.prepare('SELECT id, family_id, role, name FROM members WHERE token_hash = ?')
    .bind(hash)
    .first<Member>();
}

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
