/**
 * ThemeContext Tests
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QZPayThemeProvider, useQZPayTheme } from '../../src/theme/ThemeContext.js';
import { qzpayDarkTheme, qzpayDefaultTheme } from '../../src/theme/default-theme.js';
import type { QZPayPartialTheme, QZPayTheme } from '../../src/theme/theme.types.js';

function TestComponent() {
    const theme = useQZPayTheme();
    return (
        <div data-testid="test-component">
            <div data-testid="primary-color">{theme.colors.primary}</div>
            <div data-testid="font-family">{theme.typography.fontFamily}</div>
            <div data-testid="spacing-md">{theme.spacing.md}</div>
        </div>
    );
}

describe('QZPayThemeProvider', () => {
    describe('default theme', () => {
        it('should provide default theme when no theme prop', () => {
            render(
                <QZPayThemeProvider>
                    <TestComponent />
                </QZPayThemeProvider>
            );

            expect(screen.getByTestId('primary-color')).toHaveTextContent(qzpayDefaultTheme.colors.primary);
        });

        it('should apply theme as CSS variables', () => {
            render(
                <QZPayThemeProvider>
                    <div data-testid="wrapper">Content</div>
                </QZPayThemeProvider>
            );

            const wrapper = screen.getByTestId('wrapper').parentElement;
            expect(wrapper).toHaveAttribute('data-qzpay-theme');
            expect(wrapper).toHaveStyle({ '--qzpay-color-primary': qzpayDefaultTheme.colors.primary });
        });

        it('should apply custom className to wrapper', () => {
            render(
                <QZPayThemeProvider className="custom-theme-wrapper">
                    <div>Content</div>
                </QZPayThemeProvider>
            );

            const wrapper = document.querySelector('[data-qzpay-theme]');
            expect(wrapper).toHaveClass('custom-theme-wrapper');
        });
    });

    describe('custom theme', () => {
        it('should merge partial theme with default theme', () => {
            const customTheme: QZPayPartialTheme = {
                colors: {
                    primary: '#ff0000',
                    primaryHover: '#cc0000'
                }
            };

            render(
                <QZPayThemeProvider theme={customTheme}>
                    <TestComponent />
                </QZPayThemeProvider>
            );

            expect(screen.getByTestId('primary-color')).toHaveTextContent('#ff0000');
            expect(screen.getByTestId('font-family')).toHaveTextContent(qzpayDefaultTheme.typography.fontFamily);
        });

        it('should use full custom theme when provided', () => {
            const customTheme: QZPayTheme = {
                ...qzpayDarkTheme,
                colors: {
                    ...qzpayDarkTheme.colors,
                    primary: '#8b5cf6'
                }
            };

            render(
                <QZPayThemeProvider theme={customTheme}>
                    <TestComponent />
                </QZPayThemeProvider>
            );

            expect(screen.getByTestId('primary-color')).toHaveTextContent('#8b5cf6');
        });

        it('should apply dark theme', () => {
            render(
                <QZPayThemeProvider theme={qzpayDarkTheme}>
                    <TestComponent />
                </QZPayThemeProvider>
            );

            expect(screen.getByTestId('primary-color')).toHaveTextContent(qzpayDarkTheme.colors.primary);
        });
    });

    describe('CSS variables generation', () => {
        it('should generate color CSS variables', () => {
            render(
                <QZPayThemeProvider>
                    <div data-testid="content">Content</div>
                </QZPayThemeProvider>
            );

            const wrapper = screen.getByTestId('content').parentElement;
            expect(wrapper).toHaveStyle({ '--qzpay-color-primary': qzpayDefaultTheme.colors.primary });
            expect(wrapper).toHaveStyle({ '--qzpay-color-primary-hover': qzpayDefaultTheme.colors.primaryHover });
            expect(wrapper).toHaveStyle({ '--qzpay-color-error': qzpayDefaultTheme.colors.error });
            expect(wrapper).toHaveStyle({ '--qzpay-color-success': qzpayDefaultTheme.colors.success });
        });

        it('should generate typography CSS variables', () => {
            render(
                <QZPayThemeProvider>
                    <div data-testid="content">Content</div>
                </QZPayThemeProvider>
            );

            const wrapper = screen.getByTestId('content').parentElement;
            expect(wrapper).toHaveStyle({ '--qzpay-font-family': qzpayDefaultTheme.typography.fontFamily });
            expect(wrapper).toHaveStyle({ '--qzpay-font-size-base': qzpayDefaultTheme.typography.fontSizeBase });
            expect(wrapper).toHaveStyle({ '--qzpay-font-weight-medium': String(qzpayDefaultTheme.typography.fontWeightMedium) });
        });

        it('should generate spacing CSS variables', () => {
            render(
                <QZPayThemeProvider>
                    <div data-testid="content">Content</div>
                </QZPayThemeProvider>
            );

            const wrapper = screen.getByTestId('content').parentElement;
            expect(wrapper).toHaveStyle({ '--qzpay-spacing-xs': qzpayDefaultTheme.spacing.xs });
            expect(wrapper).toHaveStyle({ '--qzpay-spacing-md': qzpayDefaultTheme.spacing.md });
            expect(wrapper).toHaveStyle({ '--qzpay-spacing-xl': qzpayDefaultTheme.spacing.xl });
        });

        it('should generate border radius CSS variables', () => {
            render(
                <QZPayThemeProvider>
                    <div data-testid="content">Content</div>
                </QZPayThemeProvider>
            );

            const wrapper = screen.getByTestId('content').parentElement;
            expect(wrapper).toHaveStyle({ '--qzpay-radius-sm': qzpayDefaultTheme.borderRadius.sm });
            expect(wrapper).toHaveStyle({ '--qzpay-radius-md': qzpayDefaultTheme.borderRadius.md });
            expect(wrapper).toHaveStyle({ '--qzpay-radius-lg': qzpayDefaultTheme.borderRadius.lg });
        });

        it('should generate shadow CSS variables', () => {
            render(
                <QZPayThemeProvider>
                    <div data-testid="content">Content</div>
                </QZPayThemeProvider>
            );

            const wrapper = screen.getByTestId('content').parentElement;
            expect(wrapper).toHaveStyle({ '--qzpay-shadow-sm': qzpayDefaultTheme.shadows.sm });
            expect(wrapper).toHaveStyle({ '--qzpay-shadow-md': qzpayDefaultTheme.shadows.md });
            expect(wrapper).toHaveStyle({ '--qzpay-shadow-lg': qzpayDefaultTheme.shadows.lg });
        });

        it('should generate transition CSS variables', () => {
            render(
                <QZPayThemeProvider>
                    <div data-testid="content">Content</div>
                </QZPayThemeProvider>
            );

            const wrapper = screen.getByTestId('content').parentElement;
            expect(wrapper).toHaveStyle({ '--qzpay-transition-fast': qzpayDefaultTheme.transitions.fast });
            expect(wrapper).toHaveStyle({ '--qzpay-transition-normal': qzpayDefaultTheme.transitions.normal });
            expect(wrapper).toHaveStyle({ '--qzpay-transition-easing': qzpayDefaultTheme.transitions.easing });
        });
    });

    describe('nested providers', () => {
        it('should use innermost provider theme', () => {
            const outerTheme: QZPayPartialTheme = {
                colors: { primary: '#ff0000' }
            };

            const innerTheme: QZPayPartialTheme = {
                colors: { primary: '#00ff00' }
            };

            function InnerComponent() {
                const theme = useQZPayTheme();
                return <div data-testid="inner-primary">{theme.colors.primary}</div>;
            }

            render(
                <QZPayThemeProvider theme={outerTheme}>
                    <div data-testid="outer">
                        <QZPayThemeProvider theme={innerTheme}>
                            <InnerComponent />
                        </QZPayThemeProvider>
                    </div>
                </QZPayThemeProvider>
            );

            expect(screen.getByTestId('inner-primary')).toHaveTextContent('#00ff00');
        });
    });

    describe('theme updates', () => {
        it('should update theme when prop changes', () => {
            const { rerender } = render(
                <QZPayThemeProvider theme={{ colors: { primary: '#ff0000' } }}>
                    <TestComponent />
                </QZPayThemeProvider>
            );

            expect(screen.getByTestId('primary-color')).toHaveTextContent('#ff0000');

            rerender(
                <QZPayThemeProvider theme={{ colors: { primary: '#00ff00' } }}>
                    <TestComponent />
                </QZPayThemeProvider>
            );

            expect(screen.getByTestId('primary-color')).toHaveTextContent('#00ff00');
        });
    });

    describe('applyToRoot', () => {
        it('should not apply to document root by default', () => {
            render(
                <QZPayThemeProvider>
                    <div>Content</div>
                </QZPayThemeProvider>
            );

            const rootStyle = document.documentElement.style;
            expect(rootStyle.getPropertyValue('--qzpay-color-primary')).toBe('');
        });

        it('should apply to document root when applyToRoot is true', () => {
            render(
                <QZPayThemeProvider applyToRoot={true}>
                    <div>Content</div>
                </QZPayThemeProvider>
            );

            const rootStyle = document.documentElement.style;
            expect(rootStyle.getPropertyValue('--qzpay-color-primary')).toBe(qzpayDefaultTheme.colors.primary);
        });
    });
});

describe('useQZPayTheme', () => {
    it('should return theme from context', () => {
        render(
            <QZPayThemeProvider>
                <TestComponent />
            </QZPayThemeProvider>
        );

        expect(screen.getByTestId('primary-color')).toHaveTextContent(qzpayDefaultTheme.colors.primary);
        expect(screen.getByTestId('font-family')).toHaveTextContent(qzpayDefaultTheme.typography.fontFamily);
        expect(screen.getByTestId('spacing-md')).toHaveTextContent(qzpayDefaultTheme.spacing.md);
    });

    it('should return default theme when no provider', () => {
        render(<TestComponent />);

        expect(screen.getByTestId('primary-color')).toHaveTextContent(qzpayDefaultTheme.colors.primary);
    });

    it('should return custom theme when provided', () => {
        const customTheme: QZPayPartialTheme = {
            colors: {
                primary: '#purple'
            },
            spacing: {
                md: '20px'
            }
        };

        render(
            <QZPayThemeProvider theme={customTheme}>
                <TestComponent />
            </QZPayThemeProvider>
        );

        expect(screen.getByTestId('primary-color')).toHaveTextContent('#purple');
        expect(screen.getByTestId('spacing-md')).toHaveTextContent('20px');
    });

    describe('theme object structure', () => {
        function ThemeStructureTest() {
            const theme = useQZPayTheme();
            return (
                <div data-testid="theme-structure">
                    <div data-testid="has-colors">{theme.colors ? 'true' : 'false'}</div>
                    <div data-testid="has-typography">{theme.typography ? 'true' : 'false'}</div>
                    <div data-testid="has-spacing">{theme.spacing ? 'true' : 'false'}</div>
                    <div data-testid="has-border-radius">{theme.borderRadius ? 'true' : 'false'}</div>
                    <div data-testid="has-shadows">{theme.shadows ? 'true' : 'false'}</div>
                    <div data-testid="has-transitions">{theme.transitions ? 'true' : 'false'}</div>
                </div>
            );
        }

        it('should have all required theme sections', () => {
            render(
                <QZPayThemeProvider>
                    <ThemeStructureTest />
                </QZPayThemeProvider>
            );

            expect(screen.getByTestId('has-colors')).toHaveTextContent('true');
            expect(screen.getByTestId('has-typography')).toHaveTextContent('true');
            expect(screen.getByTestId('has-spacing')).toHaveTextContent('true');
            expect(screen.getByTestId('has-border-radius')).toHaveTextContent('true');
            expect(screen.getByTestId('has-shadows')).toHaveTextContent('true');
            expect(screen.getByTestId('has-transitions')).toHaveTextContent('true');
        });
    });
});
