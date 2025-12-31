/**
 * Day of week constants
 */
export const QZPAY_DAY_OF_WEEK = {
    SUNDAY: 0,
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
    SATURDAY: 6
} as const;

export type QZPayDayOfWeek = (typeof QZPAY_DAY_OF_WEEK)[keyof typeof QZPAY_DAY_OF_WEEK];

export const QZPAY_DAY_OF_WEEK_VALUES = Object.values(QZPAY_DAY_OF_WEEK) as readonly QZPayDayOfWeek[];
