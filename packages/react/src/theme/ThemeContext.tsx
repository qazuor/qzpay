/**
 * Theme Context for QZPay React components
 */
import type { CSSProperties } from 'react';
import { type ReactNode, createContext, useContext, useEffect, useMemo } from 'react';
import { qzpayDefaultTheme, qzpayMergeTheme } from './default-theme.js';
import type { QZPayPartialTheme, QZPayTheme } from './theme.types.js';

/**
 * Theme context value
 */
interface QZPayThemeContextValue {
    theme: QZPayTheme;
}

/**
 * Internal theme context
 */
const QZPayThemeContext = createContext<QZPayThemeContextValue | null>(null);

/**
 * Generate CSS variables from theme
 */
function generateCSSVariables(theme: QZPayTheme): string {
    const vars: string[] = [];

    // Colors
    vars.push(`--qzpay-color-primary: ${theme.colors.primary}`);
    vars.push(`--qzpay-color-primary-hover: ${theme.colors.primaryHover}`);
    vars.push(`--qzpay-color-primary-text: ${theme.colors.primaryText}`);
    vars.push(`--qzpay-color-secondary: ${theme.colors.secondary}`);
    vars.push(`--qzpay-color-secondary-hover: ${theme.colors.secondaryHover}`);
    vars.push(`--qzpay-color-secondary-text: ${theme.colors.secondaryText}`);
    vars.push(`--qzpay-color-success: ${theme.colors.success}`);
    vars.push(`--qzpay-color-success-bg: ${theme.colors.successBackground}`);
    vars.push(`--qzpay-color-success-text: ${theme.colors.successText}`);
    vars.push(`--qzpay-color-warning: ${theme.colors.warning}`);
    vars.push(`--qzpay-color-warning-bg: ${theme.colors.warningBackground}`);
    vars.push(`--qzpay-color-warning-text: ${theme.colors.warningText}`);
    vars.push(`--qzpay-color-error: ${theme.colors.error}`);
    vars.push(`--qzpay-color-error-bg: ${theme.colors.errorBackground}`);
    vars.push(`--qzpay-color-error-text: ${theme.colors.errorText}`);
    vars.push(`--qzpay-color-background: ${theme.colors.background}`);
    vars.push(`--qzpay-color-surface: ${theme.colors.surface}`);
    vars.push(`--qzpay-color-border: ${theme.colors.border}`);
    vars.push(`--qzpay-color-muted: ${theme.colors.muted}`);
    vars.push(`--qzpay-color-text: ${theme.colors.text}`);
    vars.push(`--qzpay-color-text-secondary: ${theme.colors.textSecondary}`);
    vars.push(`--qzpay-color-text-disabled: ${theme.colors.textDisabled}`);

    // Typography
    vars.push(`--qzpay-font-family: ${theme.typography.fontFamily}`);
    vars.push(`--qzpay-font-family-mono: ${theme.typography.fontFamilyMono}`);
    vars.push(`--qzpay-font-size-base: ${theme.typography.fontSizeBase}`);
    vars.push(`--qzpay-font-size-sm: ${theme.typography.fontSizeSm}`);
    vars.push(`--qzpay-font-size-lg: ${theme.typography.fontSizeLg}`);
    vars.push(`--qzpay-font-size-xl: ${theme.typography.fontSizeXl}`);
    vars.push(`--qzpay-font-weight-normal: ${theme.typography.fontWeightNormal}`);
    vars.push(`--qzpay-font-weight-medium: ${theme.typography.fontWeightMedium}`);
    vars.push(`--qzpay-font-weight-bold: ${theme.typography.fontWeightBold}`);
    vars.push(`--qzpay-line-height-base: ${theme.typography.lineHeightBase}`);
    vars.push(`--qzpay-line-height-tight: ${theme.typography.lineHeightTight}`);
    vars.push(`--qzpay-line-height-relaxed: ${theme.typography.lineHeightRelaxed}`);

    // Spacing
    vars.push(`--qzpay-spacing-xs: ${theme.spacing.xs}`);
    vars.push(`--qzpay-spacing-sm: ${theme.spacing.sm}`);
    vars.push(`--qzpay-spacing-md: ${theme.spacing.md}`);
    vars.push(`--qzpay-spacing-lg: ${theme.spacing.lg}`);
    vars.push(`--qzpay-spacing-xl: ${theme.spacing.xl}`);
    vars.push(`--qzpay-spacing-xxl: ${theme.spacing.xxl}`);

    // Border radius
    vars.push(`--qzpay-radius-none: ${theme.borderRadius.none}`);
    vars.push(`--qzpay-radius-sm: ${theme.borderRadius.sm}`);
    vars.push(`--qzpay-radius-md: ${theme.borderRadius.md}`);
    vars.push(`--qzpay-radius-lg: ${theme.borderRadius.lg}`);
    vars.push(`--qzpay-radius-xl: ${theme.borderRadius.xl}`);
    vars.push(`--qzpay-radius-full: ${theme.borderRadius.full}`);

    // Shadows
    vars.push(`--qzpay-shadow-none: ${theme.shadows.none}`);
    vars.push(`--qzpay-shadow-sm: ${theme.shadows.sm}`);
    vars.push(`--qzpay-shadow-md: ${theme.shadows.md}`);
    vars.push(`--qzpay-shadow-lg: ${theme.shadows.lg}`);

    // Transitions
    vars.push(`--qzpay-transition-fast: ${theme.transitions.fast}`);
    vars.push(`--qzpay-transition-normal: ${theme.transitions.normal}`);
    vars.push(`--qzpay-transition-slow: ${theme.transitions.slow}`);
    vars.push(`--qzpay-transition-easing: ${theme.transitions.easing}`);

    return vars.join('; ');
}

/**
 * Props for QZPayThemeProvider
 */
interface QZPayThemeProviderProps {
    /** Theme overrides or custom theme */
    theme?: QZPayPartialTheme | QZPayTheme;
    /** Children components */
    children: ReactNode;
    /** Class name for the wrapper element */
    className?: string;
    /** Apply theme as CSS variables to document root */
    applyToRoot?: boolean;
}

/**
 * Check if a theme is a full theme or partial
 */
function isFullTheme(theme: QZPayPartialTheme | QZPayTheme): theme is QZPayTheme {
    return (
        'colors' in theme &&
        'typography' in theme &&
        'spacing' in theme &&
        'borderRadius' in theme &&
        'shadows' in theme &&
        'transitions' in theme &&
        theme.colors !== undefined &&
        'primary' in theme.colors &&
        'primaryHover' in theme.colors
    );
}

/**
 * QZPay Theme Provider
 *
 * Provides theme context to all QZPay components
 *
 * @example
 * ```tsx
 * // Use default theme
 * <QZPayThemeProvider>
 *   <YourApp />
 * </QZPayThemeProvider>
 *
 * // With custom colors
 * <QZPayThemeProvider
 *   theme={{
 *     colors: {
 *       primary: '#8b5cf6',
 *       primaryHover: '#7c3aed'
 *     }
 *   }}
 * >
 *   <YourApp />
 * </QZPayThemeProvider>
 *
 * // Dark mode
 * import { qzpayDarkTheme } from '@qazuor/qzpay-react';
 *
 * <QZPayThemeProvider theme={qzpayDarkTheme}>
 *   <YourApp />
 * </QZPayThemeProvider>
 * ```
 */
export function QZPayThemeProvider({
    theme: themeOverrides,
    children,
    className,
    applyToRoot = false
}: QZPayThemeProviderProps): ReactNode {
    const theme = useMemo(() => {
        if (!themeOverrides) {
            return qzpayDefaultTheme;
        }

        if (isFullTheme(themeOverrides)) {
            return themeOverrides;
        }

        return qzpayMergeTheme(qzpayDefaultTheme, themeOverrides);
    }, [themeOverrides]);

    const cssVariables = useMemo(() => generateCSSVariables(theme), [theme]);

    // Apply to document root if requested
    useEffect(() => {
        if (applyToRoot && typeof document !== 'undefined') {
            const root = document.documentElement;
            const vars = cssVariables.split('; ');
            for (const variable of vars) {
                const [name, value] = variable.split(': ');
                if (name && value) {
                    root.style.setProperty(name, value);
                }
            }
        }
    }, [applyToRoot, cssVariables]);

    const value = useMemo<QZPayThemeContextValue>(() => ({ theme }), [theme]);

    // Parse CSS variables into a style object
    const styleObject = useMemo(() => {
        const result: Record<string, string> = {};
        const vars = cssVariables.split('; ');
        for (const variable of vars) {
            const [name, value] = variable.split(': ');
            if (name && value) {
                result[name] = value;
            }
        }
        return result;
    }, [cssVariables]);

    return (
        <QZPayThemeContext.Provider value={value}>
            <div className={className} style={styleObject as CSSProperties} data-qzpay-theme>
                {children}
            </div>
        </QZPayThemeContext.Provider>
    );
}

/**
 * Hook to access the current theme
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const theme = useQZPayTheme();
 *
 *   return (
 *     <div style={{ color: theme.colors.primary }}>
 *       Themed content
 *     </div>
 *   );
 * }
 * ```
 */
export function useQZPayTheme(): QZPayTheme {
    const context = useContext(QZPayThemeContext);

    if (!context) {
        // Return default theme if no provider
        return qzpayDefaultTheme;
    }

    return context.theme;
}
