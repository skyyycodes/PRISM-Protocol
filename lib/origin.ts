import { NextRequest } from 'next/server';

/**
 * Standardized origin derivation for API routes.
 * Prioritizes:
 *  1. NEXT_PUBLIC_APP_URL (explicit override)
 *  2. VERCEL_URL (Vercel deployment)
 *  3. x-forwarded-* headers (Proxy)
 *  4. host header (Direct)
 */
export function getAppUrl(req: NextRequest): string {
  const protocol = req.headers.get('x-forwarded-proto') ?? 'http';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000';
  
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  return `${protocol}://${host}`;
}
