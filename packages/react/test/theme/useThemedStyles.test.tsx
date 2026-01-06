/**
 * useThemedStyles Hook Tests
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QZPayThemeProvider } from '../../src/theme/ThemeContext.js';
import { qzpayDefaultTheme } from '../../src/theme/default-theme.js';
import type { QZPayTheme } from '../../src/theme/theme.types.js';
import {
    qzpayBadgeStyles,
    qzpayButtonStyles,
    qzpayCardStyles,
    qzpayInputStyles,
    qzpayTableStyles,
    useThemedStyles
} from '../../src/theme/useThemedStyles.js';

describe('useThemedStyles', () => {
    it('should create styles from theme', () => {
        function TestComponent() {
            const styles = useThemedStyles((theme) => ({
                container: {
                    backgroundColor: theme.colors.primary,
                    padding: theme.spacing.md
                }
            }));

            return (
                <div data-testid="container" style={styles.container}>
                    Content
                </div>
            );
        }

        render(
            <QZPayThemeProvider>
                <TestComponent />
            </QZPayThemeProvider>
        );

        const container = screen.getByTestId('container');
        expect(container).toHaveStyle({
            backgroundColor: qzpayDefaultTheme.colors.primary,
            padding: qzpayDefaultTheme.spacing.md
        });
    });

    it('should update styles when theme changes', () => {
        function TestComponent() {
            const styles = useThemedStyles((theme) => ({
                box: {
                    color: theme.colors.primary
                }
            }));

            return (
                <div data-testid="box" style={styles.box}>
                    Box
                </div>
            );
        }

        const { rerender } = render(
            <QZPayThemeProvider theme={{ colors: { primary: '#ff0000' } }}>
                <TestComponent />
            </QZPayThemeProvider>
        );

        expect(screen.getByTestId('box')).toHaveStyle({ color: '#ff0000' });

        rerender(
            <QZPayThemeProvider theme={{ colors: { primary: '#00ff00' } }}>
                <TestComponent />
            </QZPayThemeProvider>
        );

        expect(screen.getByTestId('box')).toHaveStyle({ color: '#00ff00' });
    });

    it('should recalculate styles when theme changes', () => {
        let callCount = 0;

        function TestComponent() {
            const styles = useThemedStyles((theme) => {
                callCount++;
                return {
                    box: { color: theme.colors.primary }
                };
            });

            return <div style={styles.box}>Box</div>;
        }

        const { rerender } = render(
            <QZPayThemeProvider theme={{ colors: { primary: '#ff0000' } }}>
                <TestComponent />
            </QZPayThemeProvider>
        );

        const initialCallCount = callCount;

        rerender(
            <QZPayThemeProvider theme={{ colors: { primary: '#00ff00' } }}>
                <TestComponent />
            </QZPayThemeProvider>
        );

        expect(callCount).toBeGreaterThan(initialCallCount);
    });

    it('should handle complex style objects', () => {
        function TestComponent() {
            const styles = useThemedStyles((theme) => ({
                button: {
                    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                    borderRadius: theme.borderRadius.md,
                    backgroundColor: theme.colors.primary,
                    color: theme.colors.primaryText,
                    border: 'none',
                    cursor: 'pointer',
                    transition: `all ${theme.transitions.fast} ${theme.transitions.easing}`
                }
            }));

            return (
                <button type="button" data-testid="button" style={styles.button}>
                    Click
                </button>
            );
        }

        render(
            <QZPayThemeProvider>
                <TestComponent />
            </QZPayThemeProvider>
        );

        const button = screen.getByTestId('button');
        expect(button).toHaveStyle({
            padding: `${qzpayDefaultTheme.spacing.sm} ${qzpayDefaultTheme.spacing.md}`,
            borderRadius: qzpayDefaultTheme.borderRadius.md,
            backgroundColor: qzpayDefaultTheme.colors.primary
        });
    });
});

describe('qzpayButtonStyles', () => {
    it('should generate base button styles', () => {
        const styles = qzpayButtonStyles(qzpayDefaultTheme);

        expect(styles.base).toEqual(
            expect.objectContaining({
                fontFamily: qzpayDefaultTheme.typography.fontFamily,
                fontSize: qzpayDefaultTheme.typography.fontSizeBase,
                borderRadius: qzpayDefaultTheme.borderRadius.md,
                padding: `${qzpayDefaultTheme.spacing.sm} ${qzpayDefaultTheme.spacing.md}`
            })
        );
    });

    it('should generate primary button styles', () => {
        const styles = qzpayButtonStyles(qzpayDefaultTheme);

        expect(styles.primary).toEqual({
            backgroundColor: qzpayDefaultTheme.colors.primary,
            color: qzpayDefaultTheme.colors.primaryText
        });
    });

    it('should generate secondary button styles', () => {
        const styles = qzpayButtonStyles(qzpayDefaultTheme);

        expect(styles.secondary).toEqual({
            backgroundColor: 'transparent',
            color: qzpayDefaultTheme.colors.primary,
            border: `1px solid ${qzpayDefaultTheme.colors.primary}`
        });
    });

    it('should generate danger button styles', () => {
        const styles = qzpayButtonStyles(qzpayDefaultTheme);

        expect(styles.danger).toEqual({
            backgroundColor: qzpayDefaultTheme.colors.error,
            color: '#ffffff'
        });
    });

    it('should generate disabled button styles', () => {
        const styles = qzpayButtonStyles(qzpayDefaultTheme);

        expect(styles.disabled).toEqual({
            backgroundColor: qzpayDefaultTheme.colors.muted,
            color: qzpayDefaultTheme.colors.textDisabled,
            cursor: 'not-allowed'
        });
    });

    it('should work with custom theme', () => {
        const customTheme: QZPayTheme = {
            ...qzpayDefaultTheme,
            colors: {
                ...qzpayDefaultTheme.colors,
                primary: '#8b5cf6',
                primaryText: '#ffffff'
            }
        };

        const styles = qzpayButtonStyles(customTheme);

        expect(styles.primary).toEqual({
            backgroundColor: '#8b5cf6',
            color: '#ffffff'
        });
    });
});

describe('qzpayInputStyles', () => {
    it('should generate base input styles', () => {
        const styles = qzpayInputStyles(qzpayDefaultTheme);

        expect(styles.base).toEqual(
            expect.objectContaining({
                fontFamily: qzpayDefaultTheme.typography.fontFamily,
                fontSize: qzpayDefaultTheme.typography.fontSizeBase,
                padding: qzpayDefaultTheme.spacing.sm,
                borderRadius: qzpayDefaultTheme.borderRadius.md,
                border: `1px solid ${qzpayDefaultTheme.colors.border}`
            })
        );
    });

    it('should generate focus input styles', () => {
        const styles = qzpayInputStyles(qzpayDefaultTheme);

        expect(styles.focus).toEqual({
            borderColor: qzpayDefaultTheme.colors.primary,
            outline: 'none'
        });
    });

    it('should generate error input styles', () => {
        const styles = qzpayInputStyles(qzpayDefaultTheme);

        expect(styles.error).toEqual({
            borderColor: qzpayDefaultTheme.colors.error
        });
    });

    it('should generate disabled input styles', () => {
        const styles = qzpayInputStyles(qzpayDefaultTheme);

        expect(styles.disabled).toEqual({
            backgroundColor: qzpayDefaultTheme.colors.surface,
            color: qzpayDefaultTheme.colors.textDisabled,
            cursor: 'not-allowed'
        });
    });
});

describe('qzpayCardStyles', () => {
    it('should generate base card styles', () => {
        const styles = qzpayCardStyles(qzpayDefaultTheme);

        expect(styles.base).toEqual({
            backgroundColor: qzpayDefaultTheme.colors.surface,
            borderRadius: qzpayDefaultTheme.borderRadius.lg,
            border: `1px solid ${qzpayDefaultTheme.colors.border}`,
            padding: qzpayDefaultTheme.spacing.md,
            boxShadow: qzpayDefaultTheme.shadows.sm
        });
    });

    it('should generate interactive card styles', () => {
        const styles = qzpayCardStyles(qzpayDefaultTheme);

        expect(styles.interactive).toEqual({
            cursor: 'pointer',
            transition: `all ${qzpayDefaultTheme.transitions.fast} ${qzpayDefaultTheme.transitions.easing}`
        });
    });

    it('should generate selected card styles', () => {
        const styles = qzpayCardStyles(qzpayDefaultTheme);

        expect(styles.selected).toEqual({
            borderColor: qzpayDefaultTheme.colors.primary,
            borderWidth: '2px'
        });
    });
});

describe('qzpayBadgeStyles', () => {
    it('should generate base badge styles', () => {
        const styles = qzpayBadgeStyles(qzpayDefaultTheme);

        expect(styles.base).toEqual(
            expect.objectContaining({
                fontFamily: qzpayDefaultTheme.typography.fontFamily,
                fontSize: qzpayDefaultTheme.typography.fontSizeSm,
                padding: `${qzpayDefaultTheme.spacing.xs} ${qzpayDefaultTheme.spacing.sm}`,
                borderRadius: qzpayDefaultTheme.borderRadius.sm
            })
        );
    });

    it('should generate success badge styles', () => {
        const styles = qzpayBadgeStyles(qzpayDefaultTheme);

        expect(styles.success).toEqual({
            backgroundColor: qzpayDefaultTheme.colors.successBackground,
            color: qzpayDefaultTheme.colors.successText
        });
    });

    it('should generate warning badge styles', () => {
        const styles = qzpayBadgeStyles(qzpayDefaultTheme);

        expect(styles.warning).toEqual({
            backgroundColor: qzpayDefaultTheme.colors.warningBackground,
            color: qzpayDefaultTheme.colors.warningText
        });
    });

    it('should generate error badge styles', () => {
        const styles = qzpayBadgeStyles(qzpayDefaultTheme);

        expect(styles.error).toEqual({
            backgroundColor: qzpayDefaultTheme.colors.errorBackground,
            color: qzpayDefaultTheme.colors.errorText
        });
    });

    it('should generate info badge styles', () => {
        const styles = qzpayBadgeStyles(qzpayDefaultTheme);

        expect(styles.info).toEqual({
            backgroundColor: '#dbeafe',
            color: '#1d4ed8'
        });
    });

    it('should generate neutral badge styles', () => {
        const styles = qzpayBadgeStyles(qzpayDefaultTheme);

        expect(styles.neutral).toEqual({
            backgroundColor: qzpayDefaultTheme.colors.surface,
            color: qzpayDefaultTheme.colors.textSecondary
        });
    });
});

describe('qzpayTableStyles', () => {
    it('should generate table styles', () => {
        const styles = qzpayTableStyles(qzpayDefaultTheme);

        expect(styles.table).toEqual({
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: qzpayDefaultTheme.typography.fontFamily,
            fontSize: qzpayDefaultTheme.typography.fontSizeBase
        });
    });

    it('should generate header styles', () => {
        const styles = qzpayTableStyles(qzpayDefaultTheme);

        expect(styles.header).toEqual({
            borderBottom: `2px solid ${qzpayDefaultTheme.colors.border}`,
            textAlign: 'left'
        });
    });

    it('should generate header cell styles', () => {
        const styles = qzpayTableStyles(qzpayDefaultTheme);

        expect(styles.headerCell).toEqual({
            padding: `${qzpayDefaultTheme.spacing.sm} ${qzpayDefaultTheme.spacing.sm}`,
            fontWeight: qzpayDefaultTheme.typography.fontWeightMedium,
            color: qzpayDefaultTheme.colors.text
        });
    });

    it('should generate row styles', () => {
        const styles = qzpayTableStyles(qzpayDefaultTheme);

        expect(styles.row).toEqual({
            borderBottom: `1px solid ${qzpayDefaultTheme.colors.border}`
        });
    });

    it('should generate cell styles', () => {
        const styles = qzpayTableStyles(qzpayDefaultTheme);

        expect(styles.cell).toEqual({
            padding: `${qzpayDefaultTheme.spacing.sm} ${qzpayDefaultTheme.spacing.sm}`,
            color: qzpayDefaultTheme.colors.text
        });
    });
});

describe('style helpers integration', () => {
    it('should work with useThemedStyles hook', () => {
        function TestButton() {
            const styles = useThemedStyles((theme) => {
                const buttonStyles = qzpayButtonStyles(theme);
                return {
                    button: {
                        ...buttonStyles.base,
                        ...buttonStyles.primary
                    }
                };
            });

            return (
                <button type="button" data-testid="button" style={styles.button}>
                    Click
                </button>
            );
        }

        render(
            <QZPayThemeProvider>
                <TestButton />
            </QZPayThemeProvider>
        );

        const button = screen.getByTestId('button');
        expect(button).toHaveStyle({
            backgroundColor: qzpayDefaultTheme.colors.primary,
            color: qzpayDefaultTheme.colors.primaryText
        });
    });

    it('should allow style composition', () => {
        function TestCard() {
            const styles = useThemedStyles((theme) => {
                const cardStyles = qzpayCardStyles(theme);
                return {
                    card: {
                        ...cardStyles.base,
                        ...cardStyles.interactive
                    }
                };
            });

            return (
                <div data-testid="card" style={styles.card}>
                    Card
                </div>
            );
        }

        render(
            <QZPayThemeProvider>
                <TestCard />
            </QZPayThemeProvider>
        );

        const card = screen.getByTestId('card');
        expect(card).toHaveStyle({
            backgroundColor: qzpayDefaultTheme.colors.surface,
            cursor: 'pointer'
        });
    });

    it('should allow style overrides', () => {
        function TestComponent() {
            const styles = useThemedStyles((theme) => {
                const buttonStyles = qzpayButtonStyles(theme);
                return {
                    button: {
                        ...buttonStyles.base,
                        ...buttonStyles.primary,
                        borderRadius: '20px'
                    }
                };
            });

            return (
                <button type="button" data-testid="button" style={styles.button}>
                    Click
                </button>
            );
        }

        render(
            <QZPayThemeProvider>
                <TestComponent />
            </QZPayThemeProvider>
        );

        const button = screen.getByTestId('button');
        expect(button).toHaveStyle({ borderRadius: '20px' });
    });
});
