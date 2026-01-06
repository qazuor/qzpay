import type { QZPayPaymentMethod } from '@qazuor/qzpay-core';
/**
 * PaymentForm Component Tests
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PaymentForm } from '../../src/components/PaymentForm.js';
import { QZPayProvider } from '../../src/context/QZPayContext.js';
import { createMockBilling, createMockPayment } from '../helpers/react-mocks.js';

function TestWrapper({
    children,
    billing
}: {
    children: ReactNode;
    billing: ReturnType<typeof createMockBilling>;
}) {
    return <QZPayProvider billing={billing}>{children}</QZPayProvider>;
}

function createMockPaymentMethod(overrides: Partial<QZPayPaymentMethod> = {}): QZPayPaymentMethod {
    return {
        id: 'pm_123',
        customerId: 'cus_123',
        type: 'card',
        isDefault: false,
        card: {
            brand: 'visa',
            last4: '4242',
            expMonth: 12,
            expYear: 2025
        },
        metadata: {},
        createdAt: new Date(),
        ...overrides
    } as QZPayPaymentMethod;
}

describe('PaymentForm', () => {
    const defaultProps = {
        customerId: 'cus_123',
        amount: 2999,
        currency: 'usd' as const,
        paymentMethods: [createMockPaymentMethod()]
    };

    describe('rendering', () => {
        it('should render loading state when loading payment methods', () => {
            const mockBilling = createMockBilling();

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} isLoadingPaymentMethods={true} />
                </TestWrapper>
            );

            expect(screen.getByTestId('payment-form-loading')).toHaveTextContent('Loading payment methods...');
        });

        it('should render no methods state when payment methods empty', () => {
            const mockBilling = createMockBilling();

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} paymentMethods={[]} />
                </TestWrapper>
            );

            expect(screen.getByTestId('payment-form-no-methods')).toHaveTextContent(
                'No payment methods available. Please add a payment method first.'
            );
        });

        it('should render payment form', () => {
            const mockBilling = createMockBilling();

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} />
                </TestWrapper>
            );

            expect(screen.getByTestId('payment-form')).toBeInTheDocument();
        });

        it('should apply custom className', () => {
            const mockBilling = createMockBilling();

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} className="custom-class" />
                </TestWrapper>
            );

            expect(screen.getByTestId('payment-form')).toHaveClass('custom-class');
        });
    });

    describe('amount display', () => {
        it('should display formatted amount in USD', () => {
            const mockBilling = createMockBilling();

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} amount={2999} currency="usd" />
                </TestWrapper>
            );

            expect(screen.getByTestId('payment-amount')).toHaveTextContent('$29.99');
        });

        it('should display formatted amount in EUR', () => {
            const mockBilling = createMockBilling();

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} amount={4599} currency="eur" />
                </TestWrapper>
            );

            expect(screen.getByTestId('payment-amount')).toHaveTextContent(/45.99/);
        });

        it('should have label for amount', () => {
            const mockBilling = createMockBilling();

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} />
                </TestWrapper>
            );

            expect(screen.getByText('Amount')).toBeInTheDocument();
        });
    });

    describe('payment method selection', () => {
        it('should display payment method select', () => {
            const mockBilling = createMockBilling();

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} />
                </TestWrapper>
            );

            expect(screen.getByTestId('payment-method-select')).toBeInTheDocument();
        });

        it('should display all payment methods as options', () => {
            const mockBilling = createMockBilling();
            const paymentMethods = [
                createMockPaymentMethod({ id: 'pm_1', card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2025 } }),
                createMockPaymentMethod({ id: 'pm_2', card: { brand: 'mastercard', last4: '5555', expMonth: 6, expYear: 2026 } })
            ];

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} paymentMethods={paymentMethods} />
                </TestWrapper>
            );

            expect(screen.getByText(/Visa ending in 4242/)).toBeInTheDocument();
            expect(screen.getByText(/Mastercard ending in 5555/)).toBeInTheDocument();
        });

        it('should select default payment method initially', () => {
            const mockBilling = createMockBilling();
            const paymentMethods = [
                createMockPaymentMethod({ id: 'pm_1', isDefault: false }),
                createMockPaymentMethod({ id: 'pm_2', isDefault: true })
            ];

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} paymentMethods={paymentMethods} />
                </TestWrapper>
            );

            const select = screen.getByTestId('payment-method-select') as HTMLSelectElement;
            expect(select.value).toBe('pm_2');
        });

        it('should select first payment method if none default', () => {
            const mockBilling = createMockBilling();
            const paymentMethods = [
                createMockPaymentMethod({ id: 'pm_1', isDefault: false }),
                createMockPaymentMethod({ id: 'pm_2', isDefault: false })
            ];

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} paymentMethods={paymentMethods} />
                </TestWrapper>
            );

            const select = screen.getByTestId('payment-method-select') as HTMLSelectElement;
            expect(select.value).toBe('pm_1');
        });

        it('should mark default method in options', () => {
            const mockBilling = createMockBilling();
            const paymentMethods = [createMockPaymentMethod({ id: 'pm_1', isDefault: true })];

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} paymentMethods={paymentMethods} />
                </TestWrapper>
            );

            expect(screen.getByText(/\(Default\)/)).toBeInTheDocument();
        });

        it('should allow changing payment method', () => {
            const mockBilling = createMockBilling();
            const paymentMethods = [createMockPaymentMethod({ id: 'pm_1' }), createMockPaymentMethod({ id: 'pm_2' })];

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} paymentMethods={paymentMethods} />
                </TestWrapper>
            );

            const select = screen.getByTestId('payment-method-select') as HTMLSelectElement;
            fireEvent.change(select, { target: { value: 'pm_2' } });

            expect(select.value).toBe('pm_2');
        });

        it('should display bank account payment method', () => {
            const mockBilling = createMockBilling();
            const paymentMethods = [
                createMockPaymentMethod({
                    id: 'pm_bank',
                    type: 'bank_account',
                    card: undefined,
                    bankAccount: {
                        last4: '6789',
                        bankName: 'Test Bank',
                        accountType: 'checking'
                    }
                })
            ];

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} paymentMethods={paymentMethods} />
                </TestWrapper>
            );

            expect(screen.getByText(/Bank account ending in 6789/)).toBeInTheDocument();
        });
    });

    describe('form submission', () => {
        it('should process payment on submit', async () => {
            const mockBilling = createMockBilling();
            const payment = createMockPayment({ id: 'pay_123' });
            vi.mocked(mockBilling.payments.process).mockResolvedValue(payment);

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} />
                </TestWrapper>
            );

            fireEvent.submit(screen.getByTestId('payment-form'));

            await waitFor(() => {
                expect(mockBilling.payments.process).toHaveBeenCalledWith({
                    customerId: 'cus_123',
                    amount: 2999,
                    currency: 'usd',
                    paymentMethodId: 'pm_123'
                });
            });
        });

        it('should include invoiceId when provided', async () => {
            const mockBilling = createMockBilling();
            const payment = createMockPayment();
            vi.mocked(mockBilling.payments.process).mockResolvedValue(payment);

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} invoiceId="inv_123" />
                </TestWrapper>
            );

            fireEvent.submit(screen.getByTestId('payment-form'));

            await waitFor(() => {
                expect(mockBilling.payments.process).toHaveBeenCalledWith(
                    expect.objectContaining({
                        invoiceId: 'inv_123'
                    })
                );
            });
        });

        it('should call onSuccess after successful payment', async () => {
            const mockBilling = createMockBilling();
            const payment = createMockPayment({ id: 'pay_success' });
            vi.mocked(mockBilling.payments.process).mockResolvedValue(payment);

            const onSuccess = vi.fn();

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} onSuccess={onSuccess} />
                </TestWrapper>
            );

            fireEvent.submit(screen.getByTestId('payment-form'));

            await waitFor(() => {
                expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: 'pay_success' }));
            });
        });

        it('should use selected payment method', async () => {
            const mockBilling = createMockBilling();
            const payment = createMockPayment();
            vi.mocked(mockBilling.payments.process).mockResolvedValue(payment);

            const paymentMethods = [createMockPaymentMethod({ id: 'pm_1' }), createMockPaymentMethod({ id: 'pm_2' })];

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} paymentMethods={paymentMethods} />
                </TestWrapper>
            );

            const select = screen.getByTestId('payment-method-select');
            fireEvent.change(select, { target: { value: 'pm_2' } });

            fireEvent.submit(screen.getByTestId('payment-form'));

            await waitFor(() => {
                expect(mockBilling.payments.process).toHaveBeenCalledWith(
                    expect.objectContaining({
                        paymentMethodId: 'pm_2'
                    })
                );
            });
        });

        it('should show error when no payment method selected', async () => {
            const mockBilling = createMockBilling();

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} paymentMethods={[]} />
                </TestWrapper>
            );

            expect(screen.getByTestId('payment-form-no-methods')).toBeInTheDocument();
        });
    });

    describe('loading states', () => {
        it('should show processing text while processing', async () => {
            const mockBilling = createMockBilling();
            let resolvePayment: (value: ReturnType<typeof createMockPayment>) => void;
            const paymentPromise = new Promise<ReturnType<typeof createMockPayment>>((resolve) => {
                resolvePayment = resolve;
            });
            vi.mocked(mockBilling.payments.process).mockReturnValue(paymentPromise as never);

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} />
                </TestWrapper>
            );

            fireEvent.submit(screen.getByTestId('payment-form'));

            await waitFor(() => {
                expect(screen.getByTestId('payment-submit')).toHaveTextContent('Processing...');
            });

            resolvePayment?.(createMockPayment());
        });

        it('should disable form elements while processing', async () => {
            const mockBilling = createMockBilling();
            let resolvePayment: (value: ReturnType<typeof createMockPayment>) => void;
            const paymentPromise = new Promise<ReturnType<typeof createMockPayment>>((resolve) => {
                resolvePayment = resolve;
            });
            vi.mocked(mockBilling.payments.process).mockReturnValue(paymentPromise as never);

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} />
                </TestWrapper>
            );

            fireEvent.submit(screen.getByTestId('payment-form'));

            await waitFor(() => {
                expect(screen.getByTestId('payment-method-select')).toBeDisabled();
                expect(screen.getByTestId('payment-submit')).toBeDisabled();
            });

            resolvePayment?.(createMockPayment());
        });

        it('should use custom submit text when not processing', async () => {
            const mockBilling = createMockBilling();

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} submitText="Complete Payment" />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('payment-submit')).toHaveTextContent('Complete Payment');
            });
        });
    });

    describe('error handling', () => {
        it('should display error when payment fails', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.payments.process).mockRejectedValue(new Error('Payment failed'));

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} />
                </TestWrapper>
            );

            fireEvent.submit(screen.getByTestId('payment-form'));

            await waitFor(() => {
                expect(screen.getByTestId('payment-error')).toHaveTextContent('Payment failed');
            });
        });

        it('should call onError when payment fails', async () => {
            const mockBilling = createMockBilling();
            const error = new Error('Card declined');
            vi.mocked(mockBilling.payments.process).mockRejectedValue(error);

            const onError = vi.fn();

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} onError={onError} />
                </TestWrapper>
            );

            fireEvent.submit(screen.getByTestId('payment-form'));

            await waitFor(() => {
                expect(onError).toHaveBeenCalledWith(error);
            });
        });

        it('should handle non-Error exceptions', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.payments.process).mockRejectedValue('String error');

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} />
                </TestWrapper>
            );

            fireEvent.submit(screen.getByTestId('payment-form'));

            await waitFor(() => {
                expect(screen.getByTestId('payment-error')).toBeInTheDocument();
            });
        });

        it('should clear error on next submission', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.payments.process)
                .mockRejectedValueOnce(new Error('First error'))
                .mockResolvedValueOnce(createMockPayment());

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} />
                </TestWrapper>
            );

            fireEvent.submit(screen.getByTestId('payment-form'));

            await waitFor(() => {
                expect(screen.getByTestId('payment-error')).toBeInTheDocument();
            });

            fireEvent.submit(screen.getByTestId('payment-form'));

            await waitFor(() => {
                expect(screen.queryByTestId('payment-error')).not.toBeInTheDocument();
            });
        });
    });

    describe('cancel button', () => {
        it('should not show cancel button by default', () => {
            const mockBilling = createMockBilling();

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} />
                </TestWrapper>
            );

            expect(screen.queryByTestId('payment-cancel')).not.toBeInTheDocument();
        });

        it('should show cancel button when showCancel is true', () => {
            const mockBilling = createMockBilling();

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} showCancel={true} onCancel={vi.fn()} />
                </TestWrapper>
            );

            expect(screen.getByTestId('payment-cancel')).toBeInTheDocument();
        });

        it('should call onCancel when cancel button clicked', async () => {
            const mockBilling = createMockBilling();
            const onCancel = vi.fn();

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} showCancel={true} onCancel={onCancel} />
                </TestWrapper>
            );

            // Wait for the cancel button to be available
            const cancelButton = await screen.findByTestId('payment-cancel');
            fireEvent.click(cancelButton);

            expect(onCancel).toHaveBeenCalled();
        });

        it('should disable cancel button while processing', async () => {
            const mockBilling = createMockBilling();
            let resolvePayment: (value: ReturnType<typeof createMockPayment>) => void;
            const paymentPromise = new Promise<ReturnType<typeof createMockPayment>>((resolve) => {
                resolvePayment = resolve;
            });
            vi.mocked(mockBilling.payments.process).mockReturnValue(paymentPromise as never);

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} showCancel={true} onCancel={vi.fn()} />
                </TestWrapper>
            );

            fireEvent.submit(screen.getByTestId('payment-form'));

            await waitFor(() => {
                expect(screen.getByTestId('payment-cancel')).toBeDisabled();
            });

            resolvePayment?.(createMockPayment());
        });
    });

    describe('disabled state', () => {
        it('should disable form when disabled prop is true', () => {
            const mockBilling = createMockBilling();

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} disabled={true} />
                </TestWrapper>
            );

            expect(screen.getByTestId('payment-method-select')).toBeDisabled();
            expect(screen.getByTestId('payment-submit')).toBeDisabled();
        });
    });

    describe('accessibility', () => {
        it('should have proper form element', () => {
            const mockBilling = createMockBilling();

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} />
                </TestWrapper>
            );

            const form = screen.getByTestId('payment-form');
            expect(form.tagName).toBe('FORM');
        });

        it('should have labels for form elements', () => {
            const mockBilling = createMockBilling();

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} />
                </TestWrapper>
            );

            expect(screen.getByText('Amount')).toBeInTheDocument();
            expect(screen.getByLabelText('Payment Method')).toBeInTheDocument();
        });

        it('should have proper button type for submit', () => {
            const mockBilling = createMockBilling();

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} />
                </TestWrapper>
            );

            expect(screen.getByTestId('payment-submit')).toHaveAttribute('type', 'submit');
        });

        it('should have proper button type for cancel', () => {
            const mockBilling = createMockBilling();

            render(
                <TestWrapper billing={mockBilling}>
                    <PaymentForm {...defaultProps} showCancel={true} onCancel={vi.fn()} />
                </TestWrapper>
            );

            expect(screen.getByTestId('payment-cancel')).toHaveAttribute('type', 'button');
        });
    });
});
