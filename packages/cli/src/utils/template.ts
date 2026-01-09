/**
 * Template Utilities
 *
 * String transformation functions for generating code with proper naming conventions.
 *
 * @packageDocumentation
 */

/**
 * Convert kebab-case string to PascalCase.
 *
 * @param str - The kebab-case string to convert
 * @returns PascalCase string
 *
 * @example
 * ```typescript
 * toPascalCase('my-billing')  // 'MyBilling'
 * toPascalCase('test')        // 'Test'
 * toPascalCase('foo-bar-baz') // 'FooBarBaz'
 * ```
 */
export function toPascalCase(str: string): string {
    return str
        .split('-')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join('');
}

/**
 * Convert kebab-case string to camelCase.
 *
 * @param str - The kebab-case string to convert
 * @returns camelCase string
 *
 * @example
 * ```typescript
 * toCamelCase('my-billing')  // 'myBilling'
 * toCamelCase('test')        // 'test'
 * toCamelCase('foo-bar-baz') // 'fooBarBaz'
 * ```
 */
export function toCamelCase(str: string): string {
    const pascal = toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Convert kebab-case string to SCREAMING_SNAKE_CASE.
 *
 * @param str - The kebab-case string to convert
 * @returns SCREAMING_SNAKE_CASE string
 *
 * @example
 * ```typescript
 * toScreamingSnake('my-billing')  // 'MY_BILLING'
 * toScreamingSnake('test')        // 'TEST'
 * toScreamingSnake('foo-bar-baz') // 'FOO_BAR_BAZ'
 * ```
 */
export function toScreamingSnake(str: string): string {
    return str.toUpperCase().replace(/-/g, '_');
}

/**
 * Format price from cents to a human-readable string.
 *
 * @param cents - The price in cents (smallest currency unit)
 * @returns Formatted price string
 *
 * @example
 * ```typescript
 * formatPrice(0)      // 'Free'
 * formatPrice(1999)   // '$19.99'
 * formatPrice(100)    // '$1.00'
 * formatPrice(99990)  // '$999.90'
 * ```
 */
export function formatPrice(cents: number): string {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(2)}`;
}
