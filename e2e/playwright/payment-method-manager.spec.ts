import { expect, test } from '@playwright/test';

test.describe('PaymentMethodManager Component', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/payment-methods');
    });

    test('renders all payment methods', async ({ page }) => {
        await expect(page.getByTestId('payment-method-manager')).toBeVisible();

        // Should show all 4 payment methods
        const methods = page.locator('[data-testid^="payment-method-pm_"]');
        await expect(methods).toHaveCount(4);
    });

    test('displays card information correctly', async ({ page }) => {
        // Visa card
        const visaCard = page.getByTestId('payment-method-pm_visa_4242');
        await expect(visaCard).toContainText('Visa **** 4242');
        await expect(visaCard).toContainText('Expires 12/2027');
    });

    test('shows default badge on default card', async ({ page }) => {
        const visaCard = page.getByTestId('payment-method-pm_visa_4242');
        await expect(visaCard).toContainText('Default');
    });

    test('shows expiring soon badge', async ({ page }) => {
        // Mastercard expires 03/2025 - should show expiring soon
        const mcCard = page.getByTestId('payment-method-pm_mastercard_5555');
        await expect(mcCard).toContainText('Expiring Soon');
    });

    test('shows expired badge', async ({ page }) => {
        // Amex expired 01/2024
        const amexCard = page.getByTestId('payment-method-pm_amex_1234');
        await expect(amexCard).toContainText('Expired');
    });

    test('displays bank account correctly', async ({ page }) => {
        const bankAccount = page.getByTestId('payment-method-pm_bank_9999');
        await expect(bankAccount).toContainText('Bank of America **** 9999');
        await expect(bankAccount).toContainText('Savings account');
    });

    test('set default button works', async ({ page }) => {
        // Click set default on Mastercard
        await page.getByTestId('set-default-pm_mastercard_5555').click();

        // Wait for action to complete
        await expect(page.getByTestId('pm-action')).toContainText('Set default payment method: pm_mastercard_5555');

        // Check state updated
        const stateText = await page.getByTestId('pm-state').textContent();
        expect(stateText).toContain('"id": "pm_mastercard_5555"');
        expect(stateText).toContain('"isDefault": true');
    });

    test('remove button works', async ({ page }) => {
        // Get initial count
        const initialMethods = page.locator('[data-testid^="payment-method-pm_"]');
        await expect(initialMethods).toHaveCount(4);

        // Remove bank account
        await page.getByTestId('remove-pm_bank_9999').click();

        // Wait for action
        await expect(page.getByTestId('pm-action')).toContainText('Removed payment method: pm_bank_9999');

        // Should have one less payment method
        const remainingMethods = page.locator('[data-testid^="payment-method-pm_"]');
        await expect(remainingMethods).toHaveCount(3);
    });

    test('add payment method button works', async ({ page }) => {
        // Get initial count
        const initialMethods = page.locator('[data-testid^="payment-method-pm_"]');
        const initialCount = await initialMethods.count();

        // Click add button
        await page.getByTestId('add-payment-method-button').click();

        // Should show action
        await expect(page.getByTestId('pm-action')).toContainText('Add payment method clicked');

        // Should have one more payment method
        const newMethods = page.locator('[data-testid^="payment-method-pm_"]');
        await expect(newMethods).toHaveCount(initialCount + 1);
    });

    test('error simulation shows error message', async ({ page }) => {
        // Enable error simulation
        await page.getByTestId('simulate-error-checkbox').check();

        // Try to remove a card
        await page.getByTestId('remove-pm_bank_9999').click();

        // Should show error
        await expect(page.getByTestId('payment-method-manager-action-error')).toBeVisible();
        await expect(page.getByTestId('payment-method-manager-action-error')).toContainText('Simulated error');
    });

    test('set default error shows error message', async ({ page }) => {
        await page.getByTestId('simulate-error-checkbox').check();

        await page.getByTestId('set-default-pm_mastercard_5555').click();

        await expect(page.getByTestId('payment-method-manager-action-error')).toContainText('Cannot set default');
    });

    test('default card does not show set default button', async ({ page }) => {
        // Default card (Visa) should not have set default button
        await expect(page.getByTestId('set-default-pm_visa_4242')).not.toBeVisible();
    });

    test('buttons are disabled during processing', async ({ page }) => {
        // Click set default
        const setDefaultButton = page.getByTestId('set-default-pm_mastercard_5555');
        await setDefaultButton.click();

        // Button should be disabled during processing
        await expect(setDefaultButton).toBeDisabled();
    });

    test('card brand icons are displayed', async ({ page }) => {
        // Check brand icons
        const visaCard = page.getByTestId('payment-method-pm_visa_4242');
        await expect(visaCard).toContainText('VISA');

        const mcCard = page.getByTestId('payment-method-pm_mastercard_5555');
        await expect(mcCard).toContainText('MC');

        const amexCard = page.getByTestId('payment-method-pm_amex_1234');
        await expect(amexCard).toContainText('AMEX');

        const bankAccount = page.getByTestId('payment-method-pm_bank_9999');
        await expect(bankAccount).toContainText('BANK');
    });

    test('responsive layout', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });

        await expect(page.getByTestId('payment-method-manager')).toBeVisible();

        // All cards should still be visible
        const methods = page.locator('[data-testid^="payment-method-pm_"]');
        await expect(methods).toHaveCount(4);
    });
});
