/**
 * SSR Compatibility Tests
 *
 * Tests to ensure QZPay React components work correctly in Server-Side Rendering
 * environments without warnings or errors.
 */
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { QZPayThemeProvider } from '../../src/theme/ThemeContext.js';
import { qzpayDarkTheme } from '../../src/theme/default-theme.js';

/**
 * Test component that uses theme
 */
function TestComponent() {
    return (
        <div>
            <h1>Test Component</h1>
            <p>Testing SSR compatibility</p>
        </div>
    );
}

describe('SSR Compatibility', () => {
    describe('QZPayThemeProvider', () => {
        it('should render without errors in SSR environment', () => {
            expect(() => {
                renderToString(
                    <QZPayThemeProvider>
                        <TestComponent />
                    </QZPayThemeProvider>
                );
            }).not.toThrow();
        });

        it('should render with custom theme in SSR', () => {
            const html = renderToString(
                <QZPayThemeProvider theme={qzpayDarkTheme}>
                    <TestComponent />
                </QZPayThemeProvider>
            );

            expect(html).toContain('Test Component');
            expect(html).toContain('Testing SSR compatibility');
        });

        it('should render with partial theme in SSR', () => {
            const html = renderToString(
                <QZPayThemeProvider theme={{ colors: { primary: '#ff0000' } }}>
                    <TestComponent />
                </QZPayThemeProvider>
            );

            expect(html).toContain('Test Component');
        });

        it('should safely handle document access during SSR', () => {
            // In SSR, the hook uses useEffect instead of useLayoutEffect,
            // but we still expect warnings in renderToString since effects
            // don't run during server-side rendering
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

            expect(() => {
                renderToString(
                    <QZPayThemeProvider>
                        <TestComponent />
                    </QZPayThemeProvider>
                );
            }).not.toThrow();

            // Should not have critical errors, warnings are expected with renderToString
            const criticalErrors = consoleError.mock.calls.filter((call) =>
                call.some(
                    (arg) => typeof arg === 'string' && (arg.includes('document is not defined') || arg.includes('window is not defined'))
                )
            );

            expect(criticalErrors).toHaveLength(0);

            consoleError.mockRestore();
        });

        it('should render with applyToRoot without errors in SSR', () => {
            expect(() => {
                renderToString(
                    <QZPayThemeProvider applyToRoot={true}>
                        <TestComponent />
                    </QZPayThemeProvider>
                );
            }).not.toThrow();
        });

        it('should generate proper HTML structure in SSR', () => {
            const html = renderToString(
                <QZPayThemeProvider>
                    <TestComponent />
                </QZPayThemeProvider>
            );

            expect(html).toContain('data-qzpay-theme');
            expect(html).toContain('--qzpay-color-primary');
        });

        it('should handle nested providers in SSR', () => {
            const html = renderToString(
                <QZPayThemeProvider theme={{ colors: { primary: '#ff0000' } }}>
                    <div>
                        <QZPayThemeProvider theme={{ colors: { primary: '#00ff00' } }}>
                            <TestComponent />
                        </QZPayThemeProvider>
                    </div>
                </QZPayThemeProvider>
            );

            expect(html).toContain('Test Component');
        });
    });

    describe('useIsomorphicLayoutEffect', () => {
        it('should safely handle effects during SSR', () => {
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

            expect(() => {
                renderToString(
                    <QZPayThemeProvider applyToRoot={true}>
                        <TestComponent />
                    </QZPayThemeProvider>
                );
            }).not.toThrow();

            // Should not have critical errors (document/window access)
            const criticalErrors = consoleError.mock.calls.filter((call) =>
                call.some(
                    (arg) =>
                        typeof arg === 'string' &&
                        (arg.includes('document is not defined') || arg.includes('window is not defined') || arg.includes('TypeError'))
                )
            );

            expect(criticalErrors).toHaveLength(0);

            consoleError.mockRestore();
        });
    });

    describe('Window and Document access', () => {
        it('should not throw when window is undefined', () => {
            const originalWindow = global.window;
            // @ts-expect-error - Testing SSR environment
            global.window = undefined;

            expect(() => {
                renderToString(
                    <QZPayThemeProvider applyToRoot={true}>
                        <TestComponent />
                    </QZPayThemeProvider>
                );
            }).not.toThrow();

            global.window = originalWindow;
        });

        it('should not throw when document is undefined', () => {
            const originalDocument = global.document;
            // @ts-expect-error - Testing SSR environment
            global.document = undefined;

            expect(() => {
                renderToString(
                    <QZPayThemeProvider applyToRoot={true}>
                        <TestComponent />
                    </QZPayThemeProvider>
                );
            }).not.toThrow();

            global.document = originalDocument;
        });
    });
});
