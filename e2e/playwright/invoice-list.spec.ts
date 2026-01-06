import { expect, test } from '@playwright/test';

test.describe('InvoiceList Component', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/invoice-list');
    });

    test('renders invoice list with all invoices', async ({ page }) => {
        await expect(page.getByTestId('invoice-list')).toBeVisible();

        // Should show all 5 invoices by default
        const rows = page.locator('[data-testid^="invoice-row-"]');
        await expect(rows).toHaveCount(5);
    });

    test('displays invoice details correctly', async ({ page }) => {
        // Check first invoice (open)
        const openInvoice = page.getByTestId('invoice-row-inv_open_001');
        await expect(openInvoice).toContainText('inv_open');
        await expect(openInvoice).toContainText('$49.99');
    });

    test('shows correct status badges', async ({ page }) => {
        // Open status
        await expect(page.getByTestId('invoice-status-inv_open_001')).toContainText('open');

        // Paid status
        await expect(page.getByTestId('invoice-status-inv_paid_002')).toContainText('paid');

        // Draft status
        await expect(page.getByTestId('invoice-status-inv_draft_004')).toContainText('draft');

        // Uncollectible status
        await expect(page.getByTestId('invoice-status-inv_uncollect_005')).toContainText('uncollectible');
    });

    test('pay button only shows for open invoices', async ({ page }) => {
        // Open invoice should have pay button
        await expect(page.getByTestId('invoice-pay-inv_open_001')).toBeVisible();

        // Paid invoice should NOT have pay button
        await expect(page.getByTestId('invoice-pay-inv_paid_002')).not.toBeVisible();
    });

    test('download button shows for all invoices', async ({ page }) => {
        await expect(page.getByTestId('invoice-download-inv_open_001')).toBeVisible();
        await expect(page.getByTestId('invoice-download-inv_paid_002')).toBeVisible();
        await expect(page.getByTestId('invoice-download-inv_draft_004')).toBeVisible();
    });

    test('clicking pay button triggers callback', async ({ page }) => {
        await page.getByTestId('invoice-pay-inv_open_001').click();

        await expect(page.getByTestId('invoice-action')).toContainText('Pay invoice: inv_open_001');
    });

    test('clicking download button triggers callback', async ({ page }) => {
        await page.getByTestId('invoice-download-inv_paid_002').click();

        await expect(page.getByTestId('invoice-action')).toContainText('Download invoice: inv_paid_002');
    });

    test('show only unpaid filter works', async ({ page }) => {
        // Enable filter
        await page.getByTestId('show-only-unpaid').check();

        // Should only show open and uncollectible (2 invoices)
        const rows = page.locator('[data-testid^="invoice-row-"]');
        await expect(rows).toHaveCount(2);

        // Should show open invoice
        await expect(page.getByTestId('invoice-row-inv_open_001')).toBeVisible();

        // Should show uncollectible invoice
        await expect(page.getByTestId('invoice-row-inv_uncollect_005')).toBeVisible();

        // Should NOT show paid invoices
        await expect(page.getByTestId('invoice-row-inv_paid_002')).not.toBeVisible();
    });

    test('limit filter works', async ({ page }) => {
        // Set limit to 2
        await page.getByTestId('invoice-limit').fill('2');

        // Should only show 2 invoices
        const rows = page.locator('[data-testid^="invoice-row-"]');
        await expect(rows).toHaveCount(2);
    });

    test('displays different currencies correctly', async ({ page }) => {
        // EUR invoice
        const eurInvoice = page.getByTestId('invoice-row-inv_paid_003');
        await expect(eurInvoice).toContainText('€99.00');
    });

    test('shows subscription ID when present', async ({ page }) => {
        const invoiceWithSub = page.getByTestId('invoice-row-inv_open_001');
        await expect(invoiceWithSub).toContainText('Subscription:');
    });

    test('table is responsive', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });

        await expect(page.getByTestId('invoice-list')).toBeVisible();

        // Table should still be accessible on mobile
        const table = page.locator('table');
        await expect(table).toBeVisible();
    });
});
