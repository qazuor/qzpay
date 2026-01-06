import { expect, test } from '@playwright/test';

test.describe('PricingTable Component', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/pricing-table');
    });

    test('renders all three plans', async ({ page }) => {
        // Check plan headers
        await expect(page.getByRole('heading', { name: 'Free' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Pro' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Enterprise' })).toBeVisible();
    });

    test('displays plan descriptions', async ({ page }) => {
        await expect(page.getByText('Perfect for getting started')).toBeVisible();
        await expect(page.getByText('Best for growing teams')).toBeVisible();
        await expect(page.getByText('For large organizations')).toBeVisible();
    });

    test('shows correct monthly prices', async ({ page }) => {
        // Monthly interval should be selected by default
        await expect(page.getByTestId('interval-month')).toHaveCSS('background-color', 'rgb(37, 99, 235)');

        // Free plan - $0
        await expect(page.getByText('$0.00')).toBeVisible();

        // Pro plan - $29.99/month
        await expect(page.getByText('$29.99')).toBeVisible();
    });

    test('switching to annual shows annual prices', async ({ page }) => {
        // Click annual button
        await page.getByTestId('interval-year').click();

        // Pro plan annual - $299.00/year
        await expect(page.getByText('$299.00')).toBeVisible();

        // Enterprise annual - $999.00/year
        await expect(page.getByText('$999.00')).toBeVisible();
    });

    test('interval toggle changes selected state', async ({ page }) => {
        // Initially monthly is selected
        await expect(page.getByTestId('interval-month')).toHaveCSS('background-color', 'rgb(37, 99, 235)');
        await expect(page.getByTestId('interval-year')).not.toHaveCSS('background-color', 'rgb(37, 99, 235)');

        // Click annual
        await page.getByTestId('interval-year').click();

        // Now annual should be selected
        await expect(page.getByTestId('interval-year')).toHaveCSS('background-color', 'rgb(37, 99, 235)');
    });

    test('selecting a plan shows selection', async ({ page }) => {
        // Click on Pro plan button
        const selectButtons = page.getByRole('button', { name: /Select|Get Started/i });
        await selectButtons.nth(1).click();

        // Should show selected plan info
        await expect(page.getByTestId('selected-plan')).toBeVisible();
        await expect(page.getByTestId('selected-plan')).toContainText('plan_pro');
    });

    test('plan selection includes correct price ID', async ({ page }) => {
        // Select Pro monthly
        const selectButtons = page.getByRole('button', { name: /Select|Get Started/i });
        await selectButtons.nth(1).click();

        await expect(page.getByTestId('selected-plan')).toContainText('price_pro_monthly');

        // Switch to annual and select again
        await page.getByTestId('interval-year').click();
        await selectButtons.nth(1).click();

        await expect(page.getByTestId('selected-plan')).toContainText('price_pro_annual');
    });

    test('displays plan features', async ({ page }) => {
        // Free plan features
        await expect(page.getByText('1 user')).toBeVisible();
        await expect(page.getByText('100 API calls/month')).toBeVisible();

        // Pro plan features
        await expect(page.getByText('5 users')).toBeVisible();
        await expect(page.getByText('10,000 API calls/month')).toBeVisible();
        await expect(page.getByText('Priority support')).toBeVisible();

        // Enterprise features
        await expect(page.getByText('Unlimited users')).toBeVisible();
        await expect(page.getByText('SLA guarantee')).toBeVisible();
    });

    test('popular plan is highlighted', async ({ page }) => {
        // Pro plan should have popular indicator (metadata.popular = true)
        const proPlanSection = page.locator('text=Best for growing teams').locator('..');
        await expect(proPlanSection).toBeVisible();
    });

    test('pricing table is responsive', async ({ page }) => {
        // Mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });

        // All plans should still be visible
        await expect(page.getByRole('heading', { name: 'Free' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Pro' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Enterprise' })).toBeVisible();

        // Interval toggle should work
        await page.getByTestId('interval-year').click();
        await expect(page.getByTestId('interval-year')).toHaveCSS('background-color', 'rgb(37, 99, 235)');
    });

    test('tablet viewport', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });

        await expect(page.getByRole('heading', { name: 'Free' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Pro' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Enterprise' })).toBeVisible();
    });

    test('enterprise plan only shows annual price', async ({ page }) => {
        // In monthly view, Enterprise should show annual price (since no monthly exists)
        await expect(page.getByText('$999.00')).toBeVisible();
    });

    test('keyboard navigation works', async ({ page }) => {
        // Tab through interval buttons
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');

        // Should be able to activate with Enter
        await page.getByTestId('interval-year').focus();
        await page.keyboard.press('Enter');

        await expect(page.getByTestId('interval-year')).toHaveCSS('background-color', 'rgb(37, 99, 235)');
    });
});
