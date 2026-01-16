import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Safe translation component that renders formatted text with bold sections
 * Replaces <strong>text</strong> with React elements
 *
 * @example
 * // In i18n JSON: "text": "Hello <strong>world</strong>!"
 * <Trans>text</Trans>
 * // Renders: Hello <strong>world</strong>!
 */
export function Trans({ children, values }: { children: string; values?: Record<string, string | number> }) {
    const { t } = useTranslation();
    const text = t(children, values);

    return <SafeFormattedText text={text} />;
}

/**
 * Component that safely renders text with <strong> formatting
 * Only supports <strong> tags for security
 */
export function SafeFormattedText({ text }: { text: string }) {
    // Split text by <strong> tags
    const parts = text.split(/(<strong>.*?<\/strong>)/g);

    return (
        <>
            {parts.map((part, index) => {
                // Check if this part is a <strong> tag
                const strongMatch = part.match(/^<strong>(.*?)<\/strong>$/);
                if (strongMatch) {
                    return <strong key={index}>{strongMatch[1]}</strong>;
                }
                // Return regular text
                return <Fragment key={index}>{part}</Fragment>;
            })}
        </>
    );
}

/**
 * Hook that extends useTranslation with safe formatting capabilities
 *
 * @example
 * const { t, ts } = useSafeTranslation('simulation');
 *
 * // Regular translation
 * <p>{t('customers.title')}</p>
 *
 * // Safe formatted translation (renders <strong> tags as React elements)
 * <p>{ts('customers.helpNextStep')}</p>
 */
export function useSafeTranslation(namespace?: string) {
    const translation = useTranslation(namespace);

    /**
     * Safe translation function that renders formatted text
     * Converts <strong> HTML tags to React elements
     */
    const ts = (key: string, options?: Record<string, unknown>): ReactNode => {
        const text = translation.t(key, options);
        return <SafeFormattedText text={text} />;
    };

    return {
        ...translation,
        ts
    };
}
