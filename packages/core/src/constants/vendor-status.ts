/**
 * Vendor status constants (for marketplace scenarios)
 */
export const QZPAY_VENDOR_STATUS = {
    PENDING: 'pending',
    ACTIVE: 'active',
    SUSPENDED: 'suspended',
    REJECTED: 'rejected'
} as const;

export type QZPayVendorStatus = (typeof QZPAY_VENDOR_STATUS)[keyof typeof QZPAY_VENDOR_STATUS];

export const QZPAY_VENDOR_STATUS_VALUES = Object.values(QZPAY_VENDOR_STATUS) as readonly QZPayVendorStatus[];
