/**
 * Currency constants (ISO 4217)
 */
export const QZPAY_CURRENCY = {
    USD: 'USD',
    EUR: 'EUR',
    GBP: 'GBP',
    ARS: 'ARS',
    BRL: 'BRL',
    MXN: 'MXN',
    CLP: 'CLP',
    COP: 'COP',
    PEN: 'PEN',
    UYU: 'UYU'
} as const;

export type QZPayCurrency = (typeof QZPAY_CURRENCY)[keyof typeof QZPAY_CURRENCY];

export const QZPAY_CURRENCY_VALUES = Object.values(QZPAY_CURRENCY) as readonly QZPayCurrency[];
