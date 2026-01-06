/**
 * Hook for creating themed styles
 */
import { type CSSProperties, useMemo } from 'react';
import { useQZPayTheme } from './ThemeContext.js';
import type { QZPayTheme } from './theme.types.js';

/**
 * Style creator function type
 */
export type QZPayStyleCreator<T extends Record<string, CSSProperties>> = (theme: QZPayTheme) => T;

/**
 * Hook to create themed styles
 *
 * Creates memoized styles based on the current theme.
 * Styles are recalculated when the theme changes.
 *
 * @example
 * ```tsx
 * const createStyles = (theme: QZPayTheme) => ({
 *   container: {
 *     backgroundColor: theme.colors.surface,
 *     borderRadius: theme.borderRadius.md,
 *     padding: theme.spacing.md,
 *   },
 *   button: {
 *     backgroundColor: theme.colors.primary,
 *     color: theme.colors.primaryText,
 *     padding: `${theme.spacing.sm} ${theme.spacing.md}`,
 *   },
 * });
 *
 * function MyComponent() {
 *   const styles = useThemedStyles(createStyles);
 *
 *   return (
 *     <div style={styles.container}>
 *       <button style={styles.button}>Click me</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useThemedStyles<T extends Record<string, CSSProperties>>(creator: QZPayStyleCreator<T>): T {
    const theme = useQZPayTheme();

    return useMemo(() => creator(theme), [creator, theme]);
}

/**
 * Common button styles
 */
export const qzpayButtonStyles = (theme: QZPayTheme) => ({
    base: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.typography.fontFamily,
        fontSize: theme.typography.fontSizeBase,
        fontWeight: theme.typography.fontWeightMedium,
        lineHeight: theme.typography.lineHeightBase,
        borderRadius: theme.borderRadius.md,
        border: 'none',
        cursor: 'pointer',
        transition: `all ${theme.transitions.fast} ${theme.transitions.easing}`,
        padding: `${theme.spacing.sm} ${theme.spacing.md}`
    } as CSSProperties,
    primary: {
        backgroundColor: theme.colors.primary,
        color: theme.colors.primaryText
    } as CSSProperties,
    secondary: {
        backgroundColor: 'transparent',
        color: theme.colors.primary,
        border: `1px solid ${theme.colors.primary}`
    } as CSSProperties,
    danger: {
        backgroundColor: theme.colors.error,
        color: '#ffffff'
    } as CSSProperties,
    disabled: {
        backgroundColor: theme.colors.muted,
        color: theme.colors.textDisabled,
        cursor: 'not-allowed'
    } as CSSProperties
});

/**
 * Common input styles
 */
export const qzpayInputStyles = (theme: QZPayTheme) => ({
    base: {
        fontFamily: theme.typography.fontFamily,
        fontSize: theme.typography.fontSizeBase,
        lineHeight: theme.typography.lineHeightBase,
        padding: theme.spacing.sm,
        borderRadius: theme.borderRadius.md,
        border: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
        width: '100%',
        transition: `border-color ${theme.transitions.fast} ${theme.transitions.easing}`
    } as CSSProperties,
    focus: {
        borderColor: theme.colors.primary,
        outline: 'none'
    } as CSSProperties,
    error: {
        borderColor: theme.colors.error
    } as CSSProperties,
    disabled: {
        backgroundColor: theme.colors.surface,
        color: theme.colors.textDisabled,
        cursor: 'not-allowed'
    } as CSSProperties
});

/**
 * Common card styles
 */
export const qzpayCardStyles = (theme: QZPayTheme) => ({
    base: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.lg,
        border: `1px solid ${theme.colors.border}`,
        padding: theme.spacing.md,
        boxShadow: theme.shadows.sm
    } as CSSProperties,
    interactive: {
        cursor: 'pointer',
        transition: `all ${theme.transitions.fast} ${theme.transitions.easing}`
    } as CSSProperties,
    selected: {
        borderColor: theme.colors.primary,
        borderWidth: '2px'
    } as CSSProperties
});

/**
 * Common badge/tag styles
 */
export const qzpayBadgeStyles = (theme: QZPayTheme) => ({
    base: {
        display: 'inline-block',
        fontFamily: theme.typography.fontFamily,
        fontSize: theme.typography.fontSizeSm,
        fontWeight: theme.typography.fontWeightMedium,
        lineHeight: 1,
        padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
        borderRadius: theme.borderRadius.sm
    } as CSSProperties,
    success: {
        backgroundColor: theme.colors.successBackground,
        color: theme.colors.successText
    } as CSSProperties,
    warning: {
        backgroundColor: theme.colors.warningBackground,
        color: theme.colors.warningText
    } as CSSProperties,
    error: {
        backgroundColor: theme.colors.errorBackground,
        color: theme.colors.errorText
    } as CSSProperties,
    info: {
        backgroundColor: '#dbeafe',
        color: '#1d4ed8'
    } as CSSProperties,
    neutral: {
        backgroundColor: theme.colors.surface,
        color: theme.colors.textSecondary
    } as CSSProperties
});

/**
 * Common table styles
 */
export const qzpayTableStyles = (theme: QZPayTheme) => ({
    table: {
        width: '100%',
        borderCollapse: 'collapse' as const,
        fontFamily: theme.typography.fontFamily,
        fontSize: theme.typography.fontSizeBase
    } as CSSProperties,
    header: {
        borderBottom: `2px solid ${theme.colors.border}`,
        textAlign: 'left' as const
    } as CSSProperties,
    headerCell: {
        padding: `${theme.spacing.sm} ${theme.spacing.sm}`,
        fontWeight: theme.typography.fontWeightMedium,
        color: theme.colors.text
    } as CSSProperties,
    row: {
        borderBottom: `1px solid ${theme.colors.border}`
    } as CSSProperties,
    cell: {
        padding: `${theme.spacing.sm} ${theme.spacing.sm}`,
        color: theme.colors.text
    } as CSSProperties
});
