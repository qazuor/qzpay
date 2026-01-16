/**
 * Stripe Currency Utilities
 *
 * Validation utilities for Stripe-supported currencies
 */

/**
 * List of currencies supported by Stripe
 *
 * Reference: https://docs.stripe.com/currencies
 * Last updated: January 2025
 */
export const STRIPE_SUPPORTED_CURRENCIES = new Set([
    'usd',
    'aed',
    'afn',
    'all',
    'amd',
    'ang',
    'aoa',
    'ars',
    'aud',
    'awg',
    'azn',
    'bam',
    'bbd',
    'bdt',
    'bgn',
    'bif',
    'bmd',
    'bnd',
    'bob',
    'brl',
    'bsd',
    'bwp',
    'byn',
    'bzd',
    'cad',
    'cdf',
    'chf',
    'clp',
    'cny',
    'cop',
    'crc',
    'cve',
    'czk',
    'djf',
    'dkk',
    'dop',
    'dzd',
    'egp',
    'etb',
    'eur',
    'fjd',
    'fkp',
    'gbp',
    'gel',
    'gip',
    'gmd',
    'gnf',
    'gtq',
    'gyd',
    'hkd',
    'hnl',
    'hrk',
    'htg',
    'huf',
    'idr',
    'ils',
    'inr',
    'isk',
    'jmd',
    'jpy',
    'kes',
    'kgs',
    'khr',
    'kmf',
    'krw',
    'kyd',
    'kzt',
    'lak',
    'lbp',
    'lkr',
    'lrd',
    'lsl',
    'mad',
    'mdl',
    'mga',
    'mkd',
    'mmk',
    'mnt',
    'mop',
    'mro',
    'mur',
    'mvr',
    'mwk',
    'mxn',
    'myr',
    'mzn',
    'nad',
    'ngn',
    'nio',
    'nok',
    'npr',
    'nzd',
    'pab',
    'pen',
    'pgk',
    'php',
    'pkr',
    'pln',
    'pyg',
    'qar',
    'ron',
    'rsd',
    'rub',
    'rwf',
    'sar',
    'sbd',
    'scr',
    'sek',
    'sgd',
    'shp',
    'sle',
    'sll',
    'sos',
    'srd',
    'std',
    'szl',
    'thb',
    'tjs',
    'tnd',
    'top',
    'try',
    'ttd',
    'twd',
    'tzs',
    'uah',
    'ugx',
    'uyu',
    'uzs',
    'vnd',
    'vuv',
    'wst',
    'xaf',
    'xcd',
    'xof',
    'xpf',
    'yer',
    'zar',
    'zmw'
]);

/**
 * Validates if a currency code is supported by Stripe
 *
 * @param currency - The currency code to validate (e.g., 'USD', 'EUR')
 * @returns True if the currency is supported, false otherwise
 *
 * @example
 * ```ts
 * isValidStripeCurrency('USD') // true
 * isValidStripeCurrency('EUR') // true
 * isValidStripeCurrency('XYZ') // false
 * ```
 */
export function isValidStripeCurrency(currency: string): boolean {
    return STRIPE_SUPPORTED_CURRENCIES.has(currency.toLowerCase());
}

/**
 * Validates a currency and throws an error if not supported
 *
 * @param currency - The currency code to validate
 * @throws {Error} If the currency is not supported by Stripe
 *
 * @example
 * ```ts
 * validateStripeCurrency('USD') // No error
 * validateStripeCurrency('XYZ') // Throws error
 * ```
 */
export function validateStripeCurrency(currency: string): void {
    if (!isValidStripeCurrency(currency)) {
        throw new Error(
            `Currency '${currency}' is not supported by Stripe. See https://docs.stripe.com/currencies for supported currencies.`
        );
    }
}
