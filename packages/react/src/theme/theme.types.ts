/**
 * Theme types for QZPay React components
 */

/**
 * Color palette for the theme
 */
export interface QZPayThemeColors {
    /** Primary brand color (buttons, links, accents) */
    primary: string;
    /** Primary color for hover states */
    primaryHover: string;
    /** Primary text color on primary background */
    primaryText: string;

    /** Secondary color for secondary actions */
    secondary: string;
    /** Secondary color for hover states */
    secondaryHover: string;
    /** Secondary text color */
    secondaryText: string;

    /** Success color (for success states, confirmations) */
    success: string;
    /** Success background */
    successBackground: string;
    /** Success text */
    successText: string;

    /** Warning color (for warning states, notices) */
    warning: string;
    /** Warning background */
    warningBackground: string;
    /** Warning text */
    warningText: string;

    /** Error/danger color (for error states, destructive actions) */
    error: string;
    /** Error background */
    errorBackground: string;
    /** Error text */
    errorText: string;

    /** Background color for the main content area */
    background: string;
    /** Background color for surfaces (cards, panels) */
    surface: string;
    /** Border color for cards and containers */
    border: string;
    /** Muted/disabled elements */
    muted: string;

    /** Primary text color */
    text: string;
    /** Secondary/muted text color */
    textSecondary: string;
    /** Disabled text color */
    textDisabled: string;
}

/**
 * Typography settings
 */
export interface QZPayThemeTypography {
    /** Base font family */
    fontFamily: string;
    /** Font family for monospace/code elements */
    fontFamilyMono: string;

    /** Base font size (usually 16px) */
    fontSizeBase: string;
    /** Small text size */
    fontSizeSm: string;
    /** Large text size */
    fontSizeLg: string;
    /** Extra large/heading text size */
    fontSizeXl: string;

    /** Normal font weight */
    fontWeightNormal: number;
    /** Medium font weight */
    fontWeightMedium: number;
    /** Bold font weight */
    fontWeightBold: number;

    /** Base line height */
    lineHeightBase: number;
    /** Tight line height for headings */
    lineHeightTight: number;
    /** Relaxed line height for readable text */
    lineHeightRelaxed: number;
}

/**
 * Spacing scale
 */
export interface QZPayThemeSpacing {
    /** Extra small spacing (4px) */
    xs: string;
    /** Small spacing (8px) */
    sm: string;
    /** Medium spacing (16px) */
    md: string;
    /** Large spacing (24px) */
    lg: string;
    /** Extra large spacing (32px) */
    xl: string;
    /** 2x extra large spacing (48px) */
    xxl: string;
}

/**
 * Border radius settings
 */
export interface QZPayThemeBorderRadius {
    /** No border radius */
    none: string;
    /** Small border radius (4px) */
    sm: string;
    /** Default border radius (8px) */
    md: string;
    /** Large border radius (12px) */
    lg: string;
    /** Extra large border radius (16px) */
    xl: string;
    /** Full/pill border radius */
    full: string;
}

/**
 * Shadow settings
 */
export interface QZPayThemeShadows {
    /** No shadow */
    none: string;
    /** Small shadow */
    sm: string;
    /** Medium shadow */
    md: string;
    /** Large shadow */
    lg: string;
}

/**
 * Transition settings
 */
export interface QZPayThemeTransitions {
    /** Fast transition duration */
    fast: string;
    /** Normal transition duration */
    normal: string;
    /** Slow transition duration */
    slow: string;
    /** Default easing function */
    easing: string;
}

/**
 * Complete theme configuration
 */
export interface QZPayTheme {
    /** Theme colors */
    colors: QZPayThemeColors;
    /** Typography settings */
    typography: QZPayThemeTypography;
    /** Spacing scale */
    spacing: QZPayThemeSpacing;
    /** Border radius settings */
    borderRadius: QZPayThemeBorderRadius;
    /** Shadow settings */
    shadows: QZPayThemeShadows;
    /** Transition settings */
    transitions: QZPayThemeTransitions;
}

/**
 * Partial theme for overriding specific values
 */
export type QZPayPartialTheme = {
    colors?: Partial<QZPayThemeColors>;
    typography?: Partial<QZPayThemeTypography>;
    spacing?: Partial<QZPayThemeSpacing>;
    borderRadius?: Partial<QZPayThemeBorderRadius>;
    shadows?: Partial<QZPayThemeShadows>;
    transitions?: Partial<QZPayThemeTransitions>;
};
