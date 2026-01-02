/**
 * Payment Method Service Helpers
 *
 * Business logic for payment method management, validation, and expiration handling.
 */
import type {
    QZPayCardDetails,
    QZPayPaymentMethod,
    QZPayPaymentMethodExpirationCheck,
    QZPayPaymentMethodType
} from '../types/payment-method.types.js';

/**
 * Payment method expiration warning configuration
 */
export interface QZPayPaymentMethodExpirationConfig {
    /** Days before expiration to send warning notifications */
    warningDays: number[];
    /** Whether to auto-update from provider if supported */
    autoUpdateFromProvider: boolean;
}

/**
 * Default expiration configuration
 */
export const QZPAY_DEFAULT_EXPIRATION_CONFIG: QZPayPaymentMethodExpirationConfig = {
    warningDays: [30, 7, 1],
    autoUpdateFromProvider: true
};

/**
 * Create expiration configuration with defaults
 */
export function qzpayCreateExpirationConfig(config?: Partial<QZPayPaymentMethodExpirationConfig>): QZPayPaymentMethodExpirationConfig {
    return {
        ...QZPAY_DEFAULT_EXPIRATION_CONFIG,
        ...config
    };
}

/**
 * Get expiration date from card details
 */
export function qzpayGetCardExpirationDate(card: QZPayCardDetails): Date {
    // Cards expire at the end of the month
    // Set to the first day of the next month, then subtract 1 day
    const expDate = new Date(card.expYear, card.expMonth, 0, 23, 59, 59, 999);
    return expDate;
}

/**
 * Check if a card is expired
 */
export function qzpayIsCardExpired(card: QZPayCardDetails, now: Date = new Date()): boolean {
    const expDate = qzpayGetCardExpirationDate(card);
    return now > expDate;
}

/**
 * Get days until card expiration
 */
export function qzpayGetDaysUntilCardExpiration(card: QZPayCardDetails, now: Date = new Date()): number {
    const expDate = qzpayGetCardExpirationDate(card);
    const msUntilExp = expDate.getTime() - now.getTime();
    return Math.ceil(msUntilExp / (1000 * 60 * 60 * 24));
}

/**
 * Check payment method expiration status
 */
export function qzpayCheckPaymentMethodExpiration(
    paymentMethod: QZPayPaymentMethod,
    warningDays: number[] = QZPAY_DEFAULT_EXPIRATION_CONFIG.warningDays,
    now: Date = new Date()
): QZPayPaymentMethodExpirationCheck {
    // Only cards have expiration dates
    if (paymentMethod.type !== 'card' || !paymentMethod.card) {
        return {
            isExpired: false,
            isExpiringSoon: false,
            daysUntilExpiration: null,
            expirationDate: null
        };
    }

    const card = paymentMethod.card;
    const expirationDate = qzpayGetCardExpirationDate(card);
    const isExpired = qzpayIsCardExpired(card, now);
    const daysUntilExpiration = isExpired ? 0 : qzpayGetDaysUntilCardExpiration(card, now);

    // Check if expiring within warning period
    const maxWarningDays = Math.max(...warningDays);
    const isExpiringSoon = !isExpired && daysUntilExpiration <= maxWarningDays;

    return {
        isExpired,
        isExpiringSoon,
        daysUntilExpiration: isExpired ? 0 : daysUntilExpiration,
        expirationDate
    };
}

/**
 * Check if expiration warning should be sent
 */
export function qzpayShouldSendExpirationWarning(
    daysUntilExpiration: number,
    warningDays: number[] = QZPAY_DEFAULT_EXPIRATION_CONFIG.warningDays,
    alreadySentWarnings: number[] = []
): boolean {
    return warningDays.some((warningDay) => daysUntilExpiration === warningDay && !alreadySentWarnings.includes(warningDay));
}

/**
 * Payment method status helpers
 */

/**
 * Check if payment method is active
 */
export function qzpayPaymentMethodIsActive(paymentMethod: QZPayPaymentMethod): boolean {
    return paymentMethod.status === 'active';
}

/**
 * Check if payment method is the default
 */
export function qzpayPaymentMethodIsDefault(paymentMethod: QZPayPaymentMethod): boolean {
    return paymentMethod.isDefault;
}

/**
 * Check if payment method is expired
 */
export function qzpayPaymentMethodIsExpired(paymentMethod: QZPayPaymentMethod): boolean {
    return paymentMethod.status === 'expired';
}

/**
 * Check if payment method is valid for charges
 */
export function qzpayPaymentMethodIsValid(paymentMethod: QZPayPaymentMethod): boolean {
    return paymentMethod.status === 'active';
}

/**
 * Check if payment method can be deleted
 */
export function qzpayPaymentMethodCanBeDeleted(
    paymentMethod: QZPayPaymentMethod,
    otherPaymentMethods: QZPayPaymentMethod[],
    hasActiveSubscriptions: boolean
): { canDelete: boolean; error?: string } {
    // Cannot delete the only payment method if there are active subscriptions
    if (paymentMethod.isDefault && hasActiveSubscriptions && otherPaymentMethods.length === 0) {
        return {
            canDelete: false,
            error: 'Cannot remove the only payment method with active subscriptions'
        };
    }

    // Cannot delete default without setting another as default first
    if (paymentMethod.isDefault && otherPaymentMethods.length > 0) {
        return {
            canDelete: false,
            error: 'Set another payment method as default before removing this one'
        };
    }

    return { canDelete: true };
}

/**
 * Payment method display helpers
 */

/**
 * Get display name for payment method type
 */
export function qzpayGetPaymentMethodTypeDisplay(type: QZPayPaymentMethodType): string {
    const typeDisplayMap: Record<QZPayPaymentMethodType, string> = {
        card: 'Credit/Debit Card',
        bank_account: 'Bank Account',
        sepa_debit: 'SEPA Direct Debit',
        ideal: 'iDEAL',
        other: 'Other'
    };
    return typeDisplayMap[type];
}

/**
 * Get display label for a payment method
 */
export function qzpayGetPaymentMethodDisplayLabel(paymentMethod: QZPayPaymentMethod): string {
    if (paymentMethod.type === 'card' && paymentMethod.card) {
        const brand = paymentMethod.card.brand.charAt(0).toUpperCase() + paymentMethod.card.brand.slice(1);
        return `${brand} •••• ${paymentMethod.card.last4}`;
    }

    if (paymentMethod.type === 'bank_account' && paymentMethod.bankAccount) {
        const bankName = paymentMethod.bankAccount.bankName ?? 'Bank';
        return `${bankName} •••• ${paymentMethod.bankAccount.last4}`;
    }

    return qzpayGetPaymentMethodTypeDisplay(paymentMethod.type);
}

/**
 * Get card expiration display string
 */
export function qzpayGetCardExpirationDisplay(card: QZPayCardDetails): string {
    const month = String(card.expMonth).padStart(2, '0');
    const year = String(card.expYear).slice(-2);
    return `${month}/${year}`;
}

/**
 * Get card brand icon name (for UI)
 */
export function qzpayGetCardBrandIcon(card: QZPayCardDetails): string {
    const brandIconMap: Record<string, string> = {
        visa: 'visa',
        mastercard: 'mastercard',
        amex: 'amex',
        discover: 'discover',
        diners: 'diners',
        jcb: 'jcb',
        unionpay: 'unionpay',
        unknown: 'credit-card'
    };
    return brandIconMap[card.brand] ?? 'credit-card';
}

/**
 * Payment method validation helpers
 */

/**
 * Validate billing details
 */
export function qzpayValidateBillingDetails(billingDetails: { name?: string | null; email?: string | null }): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (billingDetails.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(billingDetails.email)) {
            errors.push('Invalid email format');
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Sort payment methods with default first
 */
export function qzpaySortPaymentMethods(paymentMethods: QZPayPaymentMethod[]): QZPayPaymentMethod[] {
    return [...paymentMethods].sort((a, b) => {
        // Default first
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        // Then by creation date (newest first)
        return b.createdAt.getTime() - a.createdAt.getTime();
    });
}

/**
 * Filter active payment methods
 */
export function qzpayFilterActivePaymentMethods(paymentMethods: QZPayPaymentMethod[]): QZPayPaymentMethod[] {
    return paymentMethods.filter((pm) => pm.status === 'active');
}

/**
 * Get payment methods expiring soon
 */
export function qzpayGetExpiringPaymentMethods(
    paymentMethods: QZPayPaymentMethod[],
    withinDays = 30,
    now: Date = new Date()
): QZPayPaymentMethod[] {
    return paymentMethods.filter((pm) => {
        if (pm.type !== 'card' || !pm.card) return false;
        const check = qzpayCheckPaymentMethodExpiration(pm, [withinDays], now);
        return check.isExpiringSoon && !check.isExpired;
    });
}
