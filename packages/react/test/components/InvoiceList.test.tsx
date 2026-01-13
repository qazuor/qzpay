import type { QZPayInvoice } from '@qazuor/qzpay-core';
/**
 * InvoiceList Component Tests
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { InvoiceList } from '../../src/components/InvoiceList.js';
import { QZPayProvider } from '../../src/context/QZPayContext.js';
import { createMockBilling } from '../helpers/react-mocks.js';

function TestWrapper({
    children,
    billing
}: {
    children: ReactNode;
    billing: ReturnType<typeof createMockBilling>;
}) {
    return <QZPayProvider billing={billing}>{children}</QZPayProvider>;
}

function createInvoice(overrides: Partial<QZPayInvoice> = {}): QZPayInvoice {
    return {
        id: 'inv_123',
        customerId: 'cus_123',
        subscriptionId: 'sub_123',
        status: 'paid',
        amountDue: 2999,
        amountPaid: 2999,
        amountRemaining: 0,
        currency: 'usd',
        dueDate: new Date(),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    } as QZPayInvoice;
}

describe('InvoiceList', () => {
    describe('rendering', () => {
        it('should render loading state', async () => {
            const mockBilling = createMockBilling();
            let resolvePromise: (value: QZPayInvoice[]) => void;
            const promise = new Promise<QZPayInvoice[]>((resolve) => {
                resolvePromise = resolve;
            });
            vi.mocked(mockBilling.invoices.getByCustomerId).mockReturnValue(promise as never);

            render(
                <TestWrapper billing={mockBilling}>
                    <InvoiceList customerId="cus_123" />
                </TestWrapper>
            );

            expect(screen.getByTestId('invoice-list-loading')).toHaveTextContent('Loading invoices...');

            resolvePromise?.([]);
        });

        it('should render error state', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.invoices.getByCustomerId).mockRejectedValue(new Error('Failed to load'));

            render(
                <TestWrapper billing={mockBilling}>
                    <InvoiceList customerId="cus_123" />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('invoice-list-error')).toHaveTextContent('Failed to load invoices: Failed to load');
            });
        });

        it('should render empty state when no invoices', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue([]);

            render(
                <TestWrapper billing={mockBilling}>
                    <InvoiceList customerId="cus_123" />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('invoice-list-empty')).toHaveTextContent('No invoices found');
            });
        });

        it('should render custom empty state', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue([]);

            render(
                <TestWrapper billing={mockBilling}>
                    <InvoiceList customerId="cus_123" emptyState={<div>Custom empty message</div>} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('invoice-list-empty')).toHaveTextContent('Custom empty message');
            });
        });

        it('should render invoices table', async () => {
            const mockBilling = createMockBilling();
            const invoices = [
                createInvoice({ id: 'inv_1', status: 'paid', amountDue: 2999 }),
                createInvoice({ id: 'inv_2', status: 'open', amountDue: 4999 })
            ];
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue(invoices);

            render(
                <TestWrapper billing={mockBilling}>
                    <InvoiceList customerId="cus_123" />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('invoice-list')).toBeInTheDocument();
            });

            expect(screen.getByTestId('invoice-row-inv_1')).toBeInTheDocument();
            expect(screen.getByTestId('invoice-row-inv_2')).toBeInTheDocument();
        });

        it('should apply custom className', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue([createInvoice()]);

            render(
                <TestWrapper billing={mockBilling}>
                    <InvoiceList customerId="cus_123" className="custom-class" />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('invoice-list')).toHaveClass('custom-class');
            });
        });
    });

    describe('invoice data display', () => {
        it('should display invoice ID (truncated)', async () => {
            const mockBilling = createMockBilling();
            const invoices = [createInvoice({ id: 'inv_1234567890' })];
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue(invoices);

            render(
                <TestWrapper billing={mockBilling}>
                    <InvoiceList customerId="cus_123" />
                </TestWrapper>
            );

            await waitFor(() => {
                // Component shows first 8 chars + "..."
                expect(screen.getByText('inv_1234...')).toBeInTheDocument();
            });
        });

        it('should display subscription ID when present', async () => {
            const mockBilling = createMockBilling();
            const invoices = [createInvoice({ subscriptionId: 'sub_9876543210' })];
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue(invoices);

            render(
                <TestWrapper billing={mockBilling}>
                    <InvoiceList customerId="cus_123" />
                </TestWrapper>
            );

            await waitFor(() => {
                // Component shows "Sub: " + first 8 chars + "..."
                expect(screen.getByText(/Sub: sub_9876\.\.\./)).toBeInTheDocument();
            });
        });

        it('should display formatted date', async () => {
            const mockBilling = createMockBilling();
            // Use UTC to avoid timezone issues in tests
            const date = new Date('2024-01-15T12:00:00Z');
            const invoices = [createInvoice({ createdAt: date })];
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue(invoices);

            render(
                <TestWrapper billing={mockBilling}>
                    <InvoiceList customerId="cus_123" />
                </TestWrapper>
            );

            // Use flexible pattern to handle timezone variations
            await waitFor(() => {
                expect(screen.getByText(/Jan 1[45], 2024/)).toBeInTheDocument();
            });
        });

        it('should display formatted amount', async () => {
            const mockBilling = createMockBilling();
            const invoices = [createInvoice({ amountDue: 2999, currency: 'usd' })];
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue(invoices);

            render(
                <TestWrapper billing={mockBilling}>
                    <InvoiceList customerId="cus_123" />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('$29.99')).toBeInTheDocument();
            });
        });

        it('should display status badge with correct style', async () => {
            const mockBilling = createMockBilling();
            const invoices = [
                createInvoice({ id: 'inv_paid', status: 'paid' }),
                createInvoice({ id: 'inv_open', status: 'open' }),
                createInvoice({ id: 'inv_draft', status: 'draft' }),
                createInvoice({ id: 'inv_void', status: 'void' })
            ];
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue(invoices);

            render(
                <TestWrapper billing={mockBilling}>
                    <InvoiceList customerId="cus_123" />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('invoice-status-inv_paid')).toHaveTextContent('paid');
                expect(screen.getByTestId('invoice-status-inv_open')).toHaveTextContent('open');
                expect(screen.getByTestId('invoice-status-inv_draft')).toHaveTextContent('draft');
                expect(screen.getByTestId('invoice-status-inv_void')).toHaveTextContent('void');
            });
        });
    });

    describe('provided invoices', () => {
        it('should use provided invoices instead of fetching', async () => {
            const mockBilling = createMockBilling();
            const providedInvoices = [createInvoice({ id: 'inv_provided' })];

            render(
                <TestWrapper billing={mockBilling}>
                    <InvoiceList customerId="cus_123" invoices={providedInvoices} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('invoice-row-inv_provided')).toBeInTheDocument();
            });
        });
    });

    describe('filtering', () => {
        it('should filter to show only unpaid invoices', async () => {
            const mockBilling = createMockBilling();
            const invoices = [
                createInvoice({ id: 'inv_paid', status: 'paid' }),
                createInvoice({ id: 'inv_open', status: 'open' }),
                createInvoice({ id: 'inv_uncollectible', status: 'uncollectible' }),
                createInvoice({ id: 'inv_draft', status: 'draft' })
            ];
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue(invoices);

            render(
                <TestWrapper billing={mockBilling}>
                    <InvoiceList customerId="cus_123" showOnlyUnpaid={true} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('invoice-row-inv_open')).toBeInTheDocument();
                expect(screen.getByTestId('invoice-row-inv_uncollectible')).toBeInTheDocument();
            });

            expect(screen.queryByTestId('invoice-row-inv_paid')).not.toBeInTheDocument();
            expect(screen.queryByTestId('invoice-row-inv_draft')).not.toBeInTheDocument();
        });

        it('should limit number of invoices displayed', async () => {
            const mockBilling = createMockBilling();
            const invoices = [
                createInvoice({ id: 'inv_1' }),
                createInvoice({ id: 'inv_2' }),
                createInvoice({ id: 'inv_3' }),
                createInvoice({ id: 'inv_4' })
            ];
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue(invoices);

            render(
                <TestWrapper billing={mockBilling}>
                    <InvoiceList customerId="cus_123" limit={2} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('invoice-row-inv_1')).toBeInTheDocument();
                expect(screen.getByTestId('invoice-row-inv_2')).toBeInTheDocument();
            });

            expect(screen.queryByTestId('invoice-row-inv_3')).not.toBeInTheDocument();
            expect(screen.queryByTestId('invoice-row-inv_4')).not.toBeInTheDocument();
        });

        it('should show empty state when filtering results in no invoices', async () => {
            const mockBilling = createMockBilling();
            const invoices = [createInvoice({ id: 'inv_paid', status: 'paid' }), createInvoice({ id: 'inv_draft', status: 'draft' })];
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue(invoices);

            render(
                <TestWrapper billing={mockBilling}>
                    <InvoiceList customerId="cus_123" showOnlyUnpaid={true} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('invoice-list-empty')).toBeInTheDocument();
            });
        });
    });

    describe('actions', () => {
        it('should show pay button only for open invoices', async () => {
            const mockBilling = createMockBilling();
            const invoices = [createInvoice({ id: 'inv_open', status: 'open' }), createInvoice({ id: 'inv_paid', status: 'paid' })];
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue(invoices);

            const onPayInvoice = vi.fn();

            render(
                <TestWrapper billing={mockBilling}>
                    <InvoiceList customerId="cus_123" onPayInvoice={onPayInvoice} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('invoice-pay-inv_open')).toBeInTheDocument();
            });

            expect(screen.queryByTestId('invoice-pay-inv_paid')).not.toBeInTheDocument();
        });

        it('should call onPayInvoice when pay button clicked', async () => {
            const mockBilling = createMockBilling();
            const invoice = createInvoice({ id: 'inv_open', status: 'open' });
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue([invoice]);

            const onPayInvoice = vi.fn();

            render(
                <TestWrapper billing={mockBilling}>
                    <InvoiceList customerId="cus_123" onPayInvoice={onPayInvoice} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('invoice-pay-inv_open')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('invoice-pay-inv_open'));

            expect(onPayInvoice).toHaveBeenCalledWith(expect.objectContaining({ id: 'inv_open' }));
        });

        it('should show download button when onDownloadInvoice provided', async () => {
            const mockBilling = createMockBilling();
            const invoice = createInvoice({ id: 'inv_123' });
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue([invoice]);

            const onDownloadInvoice = vi.fn();

            render(
                <TestWrapper billing={mockBilling}>
                    <InvoiceList customerId="cus_123" onDownloadInvoice={onDownloadInvoice} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('invoice-download-inv_123')).toBeInTheDocument();
            });
        });

        it('should call onDownloadInvoice when download button clicked', async () => {
            const mockBilling = createMockBilling();
            const invoice = createInvoice({ id: 'inv_123' });
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue([invoice]);

            const onDownloadInvoice = vi.fn();

            render(
                <TestWrapper billing={mockBilling}>
                    <InvoiceList customerId="cus_123" onDownloadInvoice={onDownloadInvoice} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('invoice-download-inv_123')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('invoice-download-inv_123'));

            expect(onDownloadInvoice).toHaveBeenCalledWith(expect.objectContaining({ id: 'inv_123' }));
        });

        it('should show both pay and download buttons when both handlers provided', async () => {
            const mockBilling = createMockBilling();
            const invoice = createInvoice({ id: 'inv_open', status: 'open' });
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue([invoice]);

            const onPayInvoice = vi.fn();
            const onDownloadInvoice = vi.fn();

            render(
                <TestWrapper billing={mockBilling}>
                    <InvoiceList customerId="cus_123" onPayInvoice={onPayInvoice} onDownloadInvoice={onDownloadInvoice} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('invoice-pay-inv_open')).toBeInTheDocument();
                expect(screen.getByTestId('invoice-download-inv_open')).toBeInTheDocument();
            });
        });

        it('should not show actions column when no handlers provided', async () => {
            const mockBilling = createMockBilling();
            const invoice = createInvoice({ id: 'inv_123' });
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue([invoice]);

            render(
                <TestWrapper billing={mockBilling}>
                    <InvoiceList customerId="cus_123" />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('invoice-list')).toBeInTheDocument();
            });

            expect(screen.queryByText('Actions')).not.toBeInTheDocument();
        });
    });

    describe('currency formatting', () => {
        it('should format EUR currency correctly', async () => {
            const mockBilling = createMockBilling();
            const invoices = [createInvoice({ amountDue: 2999, currency: 'eur' })];
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue(invoices);

            render(
                <TestWrapper billing={mockBilling}>
                    <InvoiceList customerId="cus_123" />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText(/29.99/)).toBeInTheDocument();
            });
        });

        it('should format GBP currency correctly', async () => {
            const mockBilling = createMockBilling();
            const invoices = [createInvoice({ amountDue: 2999, currency: 'gbp' })];
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue(invoices);

            render(
                <TestWrapper billing={mockBilling}>
                    <InvoiceList customerId="cus_123" />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText(/29.99/)).toBeInTheDocument();
            });
        });
    });
});
