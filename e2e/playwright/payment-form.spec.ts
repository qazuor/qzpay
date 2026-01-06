import { expect, test } from '@playwright/test';

test.describe('PaymentForm Component', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/payment-form');
    });

    test('renders payment form with amount and payment methods', async ({ page }) => {
        // Check form is visible
        await expect(page.getByTestId('payment-form')).toBeVisible();

        // Check amount is displayed correctly ($49.99)
        await expect(page.getByTestId('payment-amount')).toContainText('$49.99');

        // Check payment method select exists
        await expect(page.getByTestId('payment-method-select')).toBeVisible();
    });

    test('shows all payment methods in dropdown', async ({ page }) => {
        const select = page.getByTestId('payment-method-select');

        // Check default option (Visa)
        await expect(select).toContainText('Visa ending in 4242');

        // Open dropdown and check all options
        const options = select.locator('option');
        await expect(options).toHaveCount(3);
    });

    test('can change payment method selection', async ({ page }) => {
        const select = page.getByTestId('payment-method-select');

        // Select Mastercard
        await select.selectOption({ label: 'Mastercard ending in 5555' });

        // Verify selection
        await expect(select).toHaveValue('pm_mastercard_5555');
    });

    test('shows default payment method indicator', async ({ page }) => {
        const select = page.getByTestId('payment-method-select');

        // Default card should be marked
        await expect(select.locator('option:first-child')).toContainText('(Default)');
    });

    test('submit button is enabled when form is valid', async ({ page }) => {
        const submitButton = page.getByTestId('payment-submit');

        await expect(submitButton).toBeEnabled();
        await expect(submitButton).toContainText('Pay Now');
    });

    test('cancel button triggers onCancel callback', async ({ page }) => {
        const cancelButton = page.getByTestId('payment-cancel');

        await cancelButton.click();

        // Should show error message set by onCancel
        await expect(page.getByTestId('payment-page-error')).toContainText('Payment cancelled by user');
    });

    test('payment form is responsive', async ({ page }) => {
        // Test mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });

        const form = page.getByTestId('payment-form');
        await expect(form).toBeVisible();

        // Buttons should still be accessible
        await expect(page.getByTestId('payment-submit')).toBeVisible();
        await expect(page.getByTestId('payment-cancel')).toBeVisible();
    });

    test('displays bank account option correctly', async ({ page }) => {
        const select = page.getByTestId('payment-method-select');

        // Check bank account option exists
        await expect(select).toContainText('Chase');
        await expect(select).toContainText('1234');
    });
});
