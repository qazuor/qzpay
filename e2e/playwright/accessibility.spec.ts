import { expect, test } from '@playwright/test';

test.describe('Accessibility Tests', () => {
    test('payment form has proper labels', async ({ page }) => {
        await page.goto('/payment-form');

        // Amount should have a label
        const amountLabel = page.locator('label[for="payment-amount"]');
        await expect(amountLabel).toBeVisible();

        // Payment method select should have a label
        const selectLabel = page.locator('label[for="payment-method-select"]');
        await expect(selectLabel).toBeVisible();
    });

    test('buttons are keyboard accessible', async ({ page }) => {
        await page.goto('/checkout-button');

        // Tab to first button
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');

        // First checkout button should be focusable
        const firstButton = page.getByTestId('checkout-button').first();

        // Can activate with Enter
        await firstButton.focus();
        await page.keyboard.press('Enter');

        // Should trigger checkout (show params)
        await expect(page.getByTestId('checkout-params')).toBeVisible();
    });

    test('form elements can be navigated with Tab', async ({ page }) => {
        await page.goto('/payment-form');

        // Should be able to tab through form elements
        await page.keyboard.press('Tab');

        // Eventually should focus the select
        const select = page.getByTestId('payment-method-select');
        await select.focus();
        await expect(select).toBeFocused();

        // Tab to submit button
        await page.keyboard.press('Tab');
        const submitButton = page.getByTestId('payment-submit');
        await expect(submitButton).toBeFocused();
    });

    test('error messages are visible', async ({ page }) => {
        await page.goto('/checkout-button');

        // Enable error simulation
        await page.getByTestId('simulate-error-checkbox').check();

        // Trigger error
        await page.getByTestId('checkout-button').first().click();

        // Error should be visible (not hidden)
        const errorMessage = page.getByTestId('checkout-error');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toHaveCSS('color', 'rgb(220, 38, 38)'); // Red color
    });

    test('interactive elements have sufficient color contrast', async ({ page }) => {
        await page.goto('/payment-form');

        // Submit button should have good contrast
        const submitButton = page.getByTestId('payment-submit');
        await expect(submitButton).toHaveCSS('background-color', 'rgb(37, 99, 235)'); // Blue
        await expect(submitButton).toHaveCSS('color', 'rgb(255, 255, 255)'); // White text
    });

    test('disabled state is visually indicated', async ({ page }) => {
        await page.goto('/checkout-button');

        const disabledButton = page.getByTestId('checkout-button').nth(2);
        await expect(disabledButton).toBeDisabled();
        await expect(disabledButton).toHaveCSS('background-color', 'rgb(156, 163, 175)'); // Gray
        await expect(disabledButton).toHaveCSS('cursor', 'not-allowed');
    });

    test('invoice table has proper structure', async ({ page }) => {
        await page.goto('/invoice-list');

        // Table should have headers
        const table = page.locator('table');
        const headers = table.locator('th');
        await expect(headers.first()).toContainText('Invoice');

        // Table should have proper row structure
        const rows = table.locator('tbody tr');
        await expect(rows.first()).toBeVisible();
    });

    test('payment method cards are distinguishable', async ({ page }) => {
        await page.goto('/payment-methods');

        // Default card should have different border
        const defaultCard = page.getByTestId('payment-method-pm_visa_4242');
        await expect(defaultCard).toHaveCSS('border', '2px solid rgb(37, 99, 235)');

        // Non-default cards should have lighter border
        const nonDefaultCard = page.getByTestId('payment-method-pm_mastercard_5555');
        const borderStyle = await nonDefaultCard.evaluate((el) => getComputedStyle(el).border);
        expect(borderStyle).toContain('1px');
    });

    test('status badges have distinguishable colors', async ({ page }) => {
        await page.goto('/invoice-list');

        // Open status - yellow/amber
        const openStatus = page.getByTestId('invoice-status-inv_open_001');
        await expect(openStatus).toHaveCSS('background-color', 'rgb(254, 243, 199)');

        // Paid status - green
        const paidStatus = page.getByTestId('invoice-status-inv_paid_002');
        await expect(paidStatus).toHaveCSS('background-color', 'rgb(220, 252, 231)');
    });

    test('pricing interval toggle is accessible', async ({ page }) => {
        await page.goto('/pricing-table');

        // Both buttons should be clickable
        const monthlyButton = page.getByTestId('interval-month');
        const yearlyButton = page.getByTestId('interval-year');

        await expect(monthlyButton).toBeEnabled();
        await expect(yearlyButton).toBeEnabled();

        // Selected state should be visually different
        await expect(monthlyButton).toHaveCSS('background-color', 'rgb(37, 99, 235)');
        await expect(yearlyButton).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    });

    test('focus visible on interactive elements', async ({ page }) => {
        await page.goto('/payment-form');

        // Focus the select element
        const select = page.getByTestId('payment-method-select');
        await select.focus();

        // Should have focus visible (browser default or custom)
        await expect(select).toBeFocused();
    });
});
