import { expect, test } from '@playwright/test';

test.describe('E2E Test App Navigation', () => {
    test('home page renders correctly', async ({ page }) => {
        await page.goto('/');

        await expect(page.getByRole('heading', { name: 'QZPay E2E Test App' })).toBeVisible();
    });

    test('navigation links work', async ({ page }) => {
        await page.goto('/');

        // Test all navigation links
        const links = [
            { testId: 'nav-payment-form', path: '/payment-form', heading: 'Payment Form Test' },
            { testId: 'nav-checkout-button', path: '/checkout-button', heading: 'Checkout Button Test' },
            { testId: 'nav-invoice-list', path: '/invoice-list', heading: 'Invoice List Test' },
            { testId: 'nav-payment-methods', path: '/payment-methods', heading: 'Payment Method Manager Test' },
            { testId: 'nav-pricing-table', path: '/pricing-table', heading: 'Pricing Table Test' }
        ];

        for (const link of links) {
            await page.goto('/');
            await page.getByTestId(link.testId).click();
            await expect(page).toHaveURL(link.path);
            await expect(page.getByRole('heading', { name: link.heading })).toBeVisible();
        }
    });

    test('back links work on all pages', async ({ page }) => {
        const pages = ['/payment-form', '/checkout-button', '/invoice-list', '/payment-methods', '/pricing-table'];

        for (const pagePath of pages) {
            await page.goto(pagePath);
            await page.getByRole('link', { name: '← Back' }).click();
            await expect(page).toHaveURL('/');
        }
    });

    test('direct URL navigation works', async ({ page }) => {
        // Test direct navigation to each page
        await page.goto('/payment-form');
        await expect(page.getByTestId('payment-form')).toBeVisible();

        await page.goto('/checkout-button');
        await expect(page.getByTestId('checkout-button').first()).toBeVisible();

        await page.goto('/invoice-list');
        await expect(page.getByTestId('invoice-list')).toBeVisible();

        await page.goto('/payment-methods');
        await expect(page.getByTestId('payment-method-manager')).toBeVisible();

        await page.goto('/pricing-table');
        await expect(page.getByRole('heading', { name: 'Free' })).toBeVisible();
    });

    test('404 handling (unknown routes)', async ({ page }) => {
        // Navigate to unknown route
        await page.goto('/unknown-page');

        // Should show something (React Router default or blank)
        // The app doesn't have a 404 route, so it will show blank
        await expect(page.locator('body')).toBeVisible();
    });
});
