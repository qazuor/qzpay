import { expect, test } from '@playwright/test';

test.describe('CheckoutButton Component', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/checkout-button');
    });

    test('renders multiple checkout buttons', async ({ page }) => {
        // Check all buttons are visible
        const buttons = page.getByTestId('checkout-button');
        await expect(buttons).toHaveCount(3);
    });

    test('subscription button has correct text', async ({ page }) => {
        const buttons = page.getByTestId('checkout-button');
        await expect(buttons.first()).toContainText('Subscribe to Pro Plan');
    });

    test('disabled button is not clickable', async ({ page }) => {
        const buttons = page.getByTestId('checkout-button');
        const disabledButton = buttons.nth(2);

        await expect(disabledButton).toBeDisabled();
        await expect(disabledButton).toContainText('Disabled Button');
    });

    test('clicking checkout button shows loading state', async ({ page }) => {
        const buttons = page.getByTestId('checkout-button');
        const subscribeButton = buttons.first();

        await subscribeButton.click();

        // Should briefly show loading state
        await expect(subscribeButton).toContainText('Loading...');
    });

    test('successful checkout shows params', async ({ page }) => {
        const buttons = page.getByTestId('checkout-button');
        const subscribeButton = buttons.first();

        await subscribeButton.click();

        // Wait for checkout to complete
        await expect(page.getByTestId('checkout-params')).toBeVisible();

        // Check params were captured
        const paramsText = await page.getByTestId('checkout-params').textContent();
        expect(paramsText).toContain('subscription');
        expect(paramsText).toContain('price_monthly_pro');
    });

    test('checkout with quantity sends correct params', async ({ page }) => {
        const buttons = page.getByTestId('checkout-button');
        const buyButton = buttons.nth(1);

        await buyButton.click();

        await expect(page.getByTestId('checkout-params')).toBeVisible();

        const paramsText = await page.getByTestId('checkout-params').textContent();
        expect(paramsText).toContain('"quantity": 2');
        expect(paramsText).toContain('allowPromoCodes');
    });

    test('error simulation shows error message', async ({ page }) => {
        // Enable error simulation
        await page.getByTestId('simulate-error-checkbox').check();

        // Click checkout button
        const buttons = page.getByTestId('checkout-button');
        await buttons.first().click();

        // Should show error
        await expect(page.getByTestId('checkout-error')).toBeVisible();
        await expect(page.getByTestId('checkout-error')).toContainText('Simulated checkout error');
    });

    test('page level error is also displayed', async ({ page }) => {
        await page.getByTestId('simulate-error-checkbox').check();

        const buttons = page.getByTestId('checkout-button');
        await buttons.first().click();

        await expect(page.getByTestId('checkout-page-error')).toBeVisible();
    });

    test('checkout buttons are accessible', async ({ page }) => {
        const buttons = page.getByTestId('checkout-button');

        // All buttons should be focusable
        for (let i = 0; i < 2; i++) {
            const button = buttons.nth(i);
            await button.focus();
            await expect(button).toBeFocused();
        }
    });
});
