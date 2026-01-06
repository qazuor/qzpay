/**
 * Default theme for QZPay React components
 */
import type { QZPayTheme } from './theme.types.js';

/**
 * Default light theme
 */
export const qzpayDefaultTheme: QZPayTheme = {
    colors: {
        // Primary - Blue
        primary: '#2563eb',
        primaryHover: '#1d4ed8',
        primaryText: '#ffffff',

        // Secondary - Gray
        secondary: '#6b7280',
        secondaryHover: '#4b5563',
        secondaryText: '#ffffff',

        // Success - Green
        success: '#16a34a',
        successBackground: '#dcfce7',
        successText: '#166534',

        // Warning - Amber
        warning: '#d97706',
        warningBackground: '#fef3c7',
        warningText: '#92400e',

        // Error - Red
        error: '#dc2626',
        errorBackground: '#fee2e2',
        errorText: '#dc2626',

        // Backgrounds
        background: '#ffffff',
        surface: '#f9fafb',
        border: '#e5e7eb',
        muted: '#9ca3af',

        // Text
        text: '#111827',
        textSecondary: '#6b7280',
        textDisabled: '#9ca3af'
    },

    typography: {
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        fontFamilyMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',

        fontSizeBase: '16px',
        fontSizeSm: '14px',
        fontSizeLg: '18px',
        fontSizeXl: '24px',

        fontWeightNormal: 400,
        fontWeightMedium: 500,
        fontWeightBold: 700,

        lineHeightBase: 1.5,
        lineHeightTight: 1.25,
        lineHeightRelaxed: 1.75
    },

    spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        xxl: '48px'
    },

    borderRadius: {
        none: '0',
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        full: '9999px'
    },

    shadows: {
        none: 'none',
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'
    },

    transitions: {
        fast: '150ms',
        normal: '200ms',
        slow: '300ms',
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
    }
};

/**
 * Dark theme variant
 */
export const qzpayDarkTheme: QZPayTheme = {
    colors: {
        // Primary - Blue (brighter for dark mode)
        primary: '#3b82f6',
        primaryHover: '#60a5fa',
        primaryText: '#ffffff',

        // Secondary - Gray
        secondary: '#9ca3af',
        secondaryHover: '#d1d5db',
        secondaryText: '#111827',

        // Success - Green
        success: '#22c55e',
        successBackground: '#14532d',
        successText: '#86efac',

        // Warning - Amber
        warning: '#f59e0b',
        warningBackground: '#78350f',
        warningText: '#fde68a',

        // Error - Red
        error: '#ef4444',
        errorBackground: '#7f1d1d',
        errorText: '#fca5a5',

        // Backgrounds
        background: '#111827',
        surface: '#1f2937',
        border: '#374151',
        muted: '#4b5563',

        // Text
        text: '#f9fafb',
        textSecondary: '#9ca3af',
        textDisabled: '#6b7280'
    },

    // Inherit same typography, spacing, etc. from light theme
    typography: qzpayDefaultTheme.typography,
    spacing: qzpayDefaultTheme.spacing,
    borderRadius: qzpayDefaultTheme.borderRadius,
    shadows: {
        ...qzpayDefaultTheme.shadows,
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.2)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.3), 0 4px 6px -4px rgb(0 0 0 / 0.3)'
    },
    transitions: qzpayDefaultTheme.transitions
};

/**
 * Merge a partial theme with the default theme
 */
export function qzpayMergeTheme(
    base: QZPayTheme,
    overrides: Partial<{
        colors: Partial<QZPayTheme['colors']>;
        typography: Partial<QZPayTheme['typography']>;
        spacing: Partial<QZPayTheme['spacing']>;
        borderRadius: Partial<QZPayTheme['borderRadius']>;
        shadows: Partial<QZPayTheme['shadows']>;
        transitions: Partial<QZPayTheme['transitions']>;
    }>
): QZPayTheme {
    return {
        colors: { ...base.colors, ...overrides.colors },
        typography: { ...base.typography, ...overrides.typography },
        spacing: { ...base.spacing, ...overrides.spacing },
        borderRadius: { ...base.borderRadius, ...overrides.borderRadius },
        shadows: { ...base.shadows, ...overrides.shadows },
        transitions: { ...base.transitions, ...overrides.transitions }
    };
}
