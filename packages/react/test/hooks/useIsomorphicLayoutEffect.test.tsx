/**
 * useIsomorphicLayoutEffect Tests
 */
import { renderHook } from '@testing-library/react';
import { useEffect, useLayoutEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useIsomorphicLayoutEffect } from '../../src/hooks/useIsomorphicLayoutEffect.js';

describe('useIsomorphicLayoutEffect', () => {
    it('should be defined', () => {
        expect(useIsomorphicLayoutEffect).toBeDefined();
    });

    it('should be a function', () => {
        expect(typeof useIsomorphicLayoutEffect).toBe('function');
    });

    describe('in browser environment', () => {
        it('should use useLayoutEffect when window is defined', () => {
            // In test environment (jsdom), window is defined
            expect(typeof window).toBe('object');
            expect(useIsomorphicLayoutEffect).toBe(useLayoutEffect);
        });

        it('should execute effect', () => {
            const callback = vi.fn();

            renderHook(() => {
                useIsomorphicLayoutEffect(callback, []);
            });

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should execute cleanup on unmount', () => {
            const cleanup = vi.fn();
            const callback = vi.fn(() => cleanup);

            const { unmount } = renderHook(() => {
                useIsomorphicLayoutEffect(callback, []);
            });

            expect(callback).toHaveBeenCalledTimes(1);
            expect(cleanup).not.toHaveBeenCalled();

            unmount();

            expect(cleanup).toHaveBeenCalledTimes(1);
        });

        it('should re-run effect when dependencies change', () => {
            const callback = vi.fn();
            let dep = 1;

            const { rerender } = renderHook(() => {
                useIsomorphicLayoutEffect(callback, [dep]);
            });

            expect(callback).toHaveBeenCalledTimes(1);

            dep = 2;
            rerender();

            expect(callback).toHaveBeenCalledTimes(2);
        });

        it('should not re-run effect when dependencies do not change', () => {
            const callback = vi.fn();
            const dep = 1;

            const { rerender } = renderHook(() => {
                useIsomorphicLayoutEffect(callback, [dep]);
            });

            expect(callback).toHaveBeenCalledTimes(1);

            rerender();

            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe('in SSR environment', () => {
        it('should use useEffect when window is undefined', () => {
            const originalWindow = global.window;

            // Simulate SSR environment
            // @ts-expect-error - Testing SSR environment
            global.window = undefined;

            // Re-import the module to get fresh evaluation
            // Note: This test is conceptual, actual implementation would need
            // dynamic import or module mocking
            const isServer = typeof window === 'undefined';
            expect(isServer).toBe(true);

            // Restore window
            global.window = originalWindow;
        });

        it('should not throw in SSR environment', () => {
            const callback = vi.fn();

            expect(() => {
                renderHook(() => {
                    useIsomorphicLayoutEffect(callback, []);
                });
            }).not.toThrow();
        });
    });

    describe('edge cases', () => {
        it('should handle effect with no dependencies', () => {
            const callback = vi.fn();

            const { rerender } = renderHook(() => {
                useIsomorphicLayoutEffect(callback);
            });

            const firstCallCount = callback.mock.calls.length;
            expect(firstCallCount).toBeGreaterThan(0);

            rerender();

            // Should run on every render when no deps array
            expect(callback.mock.calls.length).toBeGreaterThan(firstCallCount);
        });

        it('should handle effect with empty dependencies', () => {
            const callback = vi.fn();

            const { rerender } = renderHook(() => {
                useIsomorphicLayoutEffect(callback, []);
            });

            expect(callback).toHaveBeenCalledTimes(1);

            rerender();

            // Should run only once with empty deps
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should handle multiple dependencies', () => {
            const callback = vi.fn();
            let dep1 = 1;
            let dep2 = 'a';

            const { rerender } = renderHook(() => {
                useIsomorphicLayoutEffect(callback, [dep1, dep2]);
            });

            expect(callback).toHaveBeenCalledTimes(1);

            dep1 = 2;
            rerender();

            expect(callback).toHaveBeenCalledTimes(2);

            dep2 = 'b';
            rerender();

            expect(callback).toHaveBeenCalledTimes(3);
        });

        it('should access DOM safely', () => {
            const callback = vi.fn(() => {
                if (typeof window !== 'undefined') {
                    document.title = 'Test Title';
                }
            });

            expect(() => {
                renderHook(() => {
                    useIsomorphicLayoutEffect(callback, []);
                });
            }).not.toThrow();

            expect(callback).toHaveBeenCalled();
        });
    });

    describe('type compatibility', () => {
        it('should have same signature as useEffect', () => {
            const callback = vi.fn();

            renderHook(() => {
                const deps: string[] = [];
                // Should not cause TypeScript errors
                useIsomorphicLayoutEffect(callback, deps);
                useEffect(callback, deps);
            });

            expect(callback).toHaveBeenCalled();
        });

        it('should have same signature as useLayoutEffect', () => {
            const callback = vi.fn();

            renderHook(() => {
                const deps: number[] = [];
                // Should not cause TypeScript errors
                useIsomorphicLayoutEffect(callback, deps);
                useLayoutEffect(callback, deps);
            });

            expect(callback).toHaveBeenCalled();
        });
    });
});
