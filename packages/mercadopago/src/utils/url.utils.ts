/**
 * URL helpers for the MercadoPago adapter.
 */

/**
 * Whether `value` is a well-formed absolute `http:`/`https:` URL.
 *
 * Used to validate a `preapproval_plan` `back_url` before handing it to
 * MercadoPago — both eagerly at adapter construction (when `defaultPlanBackUrl`
 * is configured) and lazily per request in the price adapter.
 */
export function isAbsoluteHttpUrl(value: string): boolean {
    let parsed: URL;
    try {
        parsed = new URL(value);
    } catch {
        return false;
    }
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}
