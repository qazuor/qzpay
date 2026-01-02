/**
 * Hash utilities for QZPay
 */

/**
 * Generate a random ID with optional prefix
 */
export function qzpayGenerateId(prefix?: string): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 10);
    const id = `${timestamp}${randomPart}`;
    return prefix ? `${prefix}_${id}` : id;
}

/**
 * Generate a random code (for promo codes, etc.)
 */
export function qzpayGenerateCode(length = 8): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Generate a secure random string
 */
export function qzpayGenerateSecureToken(length = 32): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a deterministic hash from a string (for idempotency keys)
 */
export async function qzpayHashString(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Create an idempotency hash from operation details
 */
export async function qzpayCreateIdempotencyHash(...parts: string[]): Promise<string> {
    const input = parts.join(':');
    return qzpayHashString(input);
}

/**
 * Mask sensitive data (for logging)
 */
export function qzpayMaskString(value: string, visibleChars = 4): string {
    if (value.length <= visibleChars) {
        return '*'.repeat(value.length);
    }
    const visible = value.slice(-visibleChars);
    const masked = '*'.repeat(value.length - visibleChars);
    return masked + visible;
}
