/**
 * useLayoutEffect that doesn't warn in SSR
 * Uses useEffect on server, useLayoutEffect on client
 *
 * @remarks
 * React warns when using useLayoutEffect on the server because it can't
 * be executed during server-side rendering. This hook uses useEffect
 * on the server (where typeof window === 'undefined') and useLayoutEffect
 * on the client to avoid the warning while maintaining the correct behavior.
 *
 * This implementation checks for window at module load time, which means:
 * - In true SSR environments (Next.js, Remix), window is undefined and useEffect is used
 * - In browser/jsdom environments, window is defined and useLayoutEffect is used
 * - renderToString from react-dom/server will still show warnings in test environments
 *   because jsdom has window defined, but this is expected and not a real issue
 *
 * @see https://github.com/facebook/react/issues/14927
 *
 * @example
 * ```tsx
 * function Component() {
 *   useIsomorphicLayoutEffect(() => {
 *     // Safe to access DOM here
 *     document.title = 'New Title';
 *   }, []);
 * }
 * ```
 */
import { useEffect, useLayoutEffect } from 'react';

/**
 * Isomorphic layout effect hook
 * - Uses useLayoutEffect on the client (when window is defined)
 * - Uses useEffect on the server (when window is undefined)
 */
export const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
