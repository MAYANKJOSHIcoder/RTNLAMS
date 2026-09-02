/**
 * Sanitize helpers — PROMPT 24 security hardening
 * Strip HTML, trim, limit length; use before any DB query
 */

export function sanitizeString(input: unknown, maxLen = 500): string {
  const s = String(input ?? '').trim();
  // Strip HTML tags naively (server should also use Zod)
  const stripped = s.replace(/<[^>]*>/g, '');
  return stripped.slice(0, maxLen);
}

export function sanitizeHtml(input: string): string {
  // Basic entity escape for user-generated content rendered as text
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Simple client-side rate limiter (token bucket)
export class RateLimiter {
  timestamps: number[] = [];
  max: number;
  windowMs: number;
  constructor(max: number, windowMs: number) {
    this.max = max;
    this.windowMs = windowMs;
  }
  tryAcquire(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);
    if (this.timestamps.length >= this.max) return false;
    this.timestamps.push(now);
    return true;
  }
}
