import type { QZPayPaymentMethod } from '@qazuor/qzpay-core';
/**
 * PaymentMethodManager Component Tests
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PaymentMethodManager } from '../../src/components/PaymentMethodManager.js';

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

describe('PaymentMethodManager', () => {
    const defaultProps = {
        customerId: 'cus_123',
        paymentMethods: [createMockPaymentMethod()]
    };

    describe('rendering', () => {
        it('should render loading state', () => {
            render(<PaymentMethodManager {...defaultProps} isLoading={true} />);
            expect(screen.getByTestId('payment-method-manager-loading')).toHaveTextContent('Loading payment methods...');
        });

        it('should render empty state when no payment methods', () => {
            render(<PaymentMethodManager {...defaultProps} paymentMethods={[]} />);
            expect(screen.getByTestId('payment-method-manager-empty')).toHaveTextContent('No payment methods added');
        });

        it('should render custom empty state', () => {
            render(<PaymentMethodManager {...defaultProps} paymentMethods={[]} emptyState={<div>Custom empty message</div>} />);
            expect(screen.getByTestId('payment-method-manager-empty')).toHaveTextContent('Custom empty message');
        });

        it('should render payment methods list', () => {
            render(<PaymentMethodManager {...defaultProps} />);
            expect(screen.getByTestId('payment-method-manager')).toBeInTheDocument();
            expect(screen.getByTestId('payment-method-pm_123')).toBeInTheDocument();
        });

        it('should apply custom className', () => {
            render(<PaymentMethodManager {...defaultProps} className="custom-class" />);
            expect(screen.getByTestId('payment-method-manager')).toHaveClass('custom-class');
        });
    });

    describe('payment method display', () => {
        it('should display card information', () => {
            const paymentMethods = [
                createMockPaymentMethod({
                    card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2025 }
                })
            ];
            render(<PaymentMethodManager {...defaultProps} paymentMethods={paymentMethods} />);

            expect(screen.getByText('Visa **** 4242')).toBeInTheDocument();
            expect(screen.getByText('Expires 12/2025')).toBeInTheDocument();
        });

        it('should display different card brands correctly', () => {
            const paymentMethods = [
                createMockPaymentMethod({
                    id: 'pm_visa',
                    card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2025 }
                }),
                createMockPaymentMethod({
                    id: 'pm_mc',
                    card: { brand: 'mastercard', last4: '5555', expMonth: 6, expYear: 2026 }
                }),
                createMockPaymentMethod({
                    id: 'pm_amex',
                    card: { brand: 'amex', last4: '1234', expMonth: 3, expYear: 2027 }
                })
            ];
            render(<PaymentMethodManager {...defaultProps} paymentMethods={paymentMethods} />);

            expect(screen.getByText('Visa **** 4242')).toBeInTheDocument();
            expect(screen.getByText('Mastercard **** 5555')).toBeInTheDocument();
            expect(screen.getByText('Amex **** 1234')).toBeInTheDocument();
        });

        it('should display bank account information', () => {
            const paymentMethods = [
                createMockPaymentMethod({
                    type: 'bank_account',
                    card: undefined,
                    bankAccount: {
                        last4: '6789',
                        bankName: 'Test Bank',
                        accountType: 'checking'
                    }
                })
            ];
            render(<PaymentMethodManager {...defaultProps} paymentMethods={paymentMethods} />);

            expect(screen.getByText('Test Bank **** 6789')).toBeInTheDocument();
            expect(screen.getByText('Checking account')).toBeInTheDocument();
        });

        it('should show default badge for default method', () => {
            const paymentMethods = [createMockPaymentMethod({ isDefault: true })];
            render(<PaymentMethodManager {...defaultProps} paymentMethods={paymentMethods} />);

            expect(screen.getByText('Default')).toBeInTheDocument();
        });

        it('should highlight default method with border', () => {
            const paymentMethods = [
                createMockPaymentMethod({ id: 'pm_default', isDefault: true }),
                createMockPaymentMethod({ id: 'pm_regular', isDefault: false })
            ];
            render(<PaymentMethodManager {...defaultProps} paymentMethods={paymentMethods} />);

            const defaultCard = screen.getByTestId('payment-method-pm_default');
            const regularCard = screen.getByTestId('payment-method-pm_regular');

            expect(defaultCard).toHaveStyle({ border: '2px solid #2563eb' });
            expect(regularCard).toHaveStyle({ border: '1px solid #e5e7eb' });
        });

        it('should show card icons', () => {
            const paymentMethods = [createMockPaymentMethod({ card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2025 } })];
            render(<PaymentMethodManager {...defaultProps} paymentMethods={paymentMethods} />);

            expect(screen.getByText('VISA')).toBeInTheDocument();
        });
    });

    describe('expiration status', () => {
        it('should show expired badge for expired cards', () => {
            const expiredDate = new Date();
            expiredDate.setMonth(expiredDate.getMonth() - 2);

            const paymentMethods = [
                createMockPaymentMethod({
                    card: {
                        brand: 'visa',
                        last4: '4242',
                        expMonth: expiredDate.getMonth() + 1,
                        expYear: expiredDate.getFullYear()
                    }
                })
            ];
            render(<PaymentMethodManager {...defaultProps} paymentMethods={paymentMethods} />);

            expect(screen.getByText('Expired')).toBeInTheDocument();
        });

        it('should show expiring soon badge for cards expiring within 60 days', () => {
            const soonDate = new Date();
            soonDate.setDate(soonDate.getDate() + 30);

            const paymentMethods = [
                createMockPaymentMethod({
                    card: {
                        brand: 'visa',
                        last4: '4242',
                        expMonth: soonDate.getMonth() + 1,
                        expYear: soonDate.getFullYear()
                    }
                })
            ];
            render(<PaymentMethodManager {...defaultProps} paymentMethods={paymentMethods} />);

            expect(screen.getByText('Expiring Soon')).toBeInTheDocument();
        });

        it('should have red background for expired cards', () => {
            const expiredDate = new Date();
            expiredDate.setMonth(expiredDate.getMonth() - 2);

            const paymentMethods = [
                createMockPaymentMethod({
                    id: 'pm_expired',
                    card: {
                        brand: 'visa',
                        last4: '4242',
                        expMonth: expiredDate.getMonth() + 1,
                        expYear: expiredDate.getFullYear()
                    }
                })
            ];
            render(<PaymentMethodManager {...defaultProps} paymentMethods={paymentMethods} />);

            const card = screen.getByTestId('payment-method-pm_expired');
            expect(card).toHaveStyle({ backgroundColor: '#fef2f2' });
        });
    });

    describe('add payment method', () => {
        it('should show add button by default in empty state', () => {
            render(<PaymentMethodManager {...defaultProps} paymentMethods={[]} onAddPaymentMethod={vi.fn()} />);
            expect(screen.getByTestId('add-payment-method-button')).toBeInTheDocument();
        });

        it('should show add button when showAddButton is true', () => {
            render(<PaymentMethodManager {...defaultProps} showAddButton={true} onAddPaymentMethod={vi.fn()} />);
            expect(screen.getByTestId('add-payment-method-button')).toBeInTheDocument();
        });

        it('should not show add button when showAddButton is false', () => {
            render(<PaymentMethodManager {...defaultProps} showAddButton={false} />);
            expect(screen.queryByTestId('add-payment-method-button')).not.toBeInTheDocument();
        });

        it('should not show add button when no handler provided', () => {
            render(<PaymentMethodManager {...defaultProps} showAddButton={true} />);
            expect(screen.queryByTestId('add-payment-method-button')).not.toBeInTheDocument();
        });

        it('should call onAddPaymentMethod when add button clicked', () => {
            const onAddPaymentMethod = vi.fn();
            render(<PaymentMethodManager {...defaultProps} onAddPaymentMethod={onAddPaymentMethod} />);

            fireEvent.click(screen.getByTestId('add-payment-method-button'));

            expect(onAddPaymentMethod).toHaveBeenCalled();
        });
    });

    describe('remove payment method', () => {
        it('should show remove button when allowRemove is true and handler provided', () => {
            render(<PaymentMethodManager {...defaultProps} allowRemove={true} onRemovePaymentMethod={vi.fn()} />);
            expect(screen.getByTestId('remove-pm_123')).toBeInTheDocument();
        });

        it('should not show remove button when allowRemove is false', () => {
            render(<PaymentMethodManager {...defaultProps} allowRemove={false} onRemovePaymentMethod={vi.fn()} />);
            expect(screen.queryByTestId('remove-pm_123')).not.toBeInTheDocument();
        });

        it('should not show remove button when no handler provided', () => {
            render(<PaymentMethodManager {...defaultProps} allowRemove={true} />);
            expect(screen.queryByTestId('remove-pm_123')).not.toBeInTheDocument();
        });

        it('should call onRemovePaymentMethod when remove button clicked', async () => {
            const onRemovePaymentMethod = vi.fn().mockResolvedValue(undefined);
            render(<PaymentMethodManager {...defaultProps} allowRemove={true} onRemovePaymentMethod={onRemovePaymentMethod} />);

            fireEvent.click(screen.getByTestId('remove-pm_123'));

            await waitFor(() => {
                expect(onRemovePaymentMethod).toHaveBeenCalledWith('pm_123');
            });
        });

        it('should show removing text while processing', async () => {
            let resolveRemove: () => void;
            const removePromise = new Promise<void>((resolve) => {
                resolveRemove = resolve;
            });
            const onRemovePaymentMethod = vi.fn().mockReturnValue(removePromise);

            render(<PaymentMethodManager {...defaultProps} allowRemove={true} onRemovePaymentMethod={onRemovePaymentMethod} />);

            fireEvent.click(screen.getByTestId('remove-pm_123'));

            await waitFor(() => {
                expect(screen.getByTestId('remove-pm_123')).toHaveTextContent('Removing...');
            });

            resolveRemove?.();
        });

        it('should disable buttons while processing', async () => {
            let resolveRemove: () => void;
            const removePromise = new Promise<void>((resolve) => {
                resolveRemove = resolve;
            });
            const onRemovePaymentMethod = vi.fn().mockReturnValue(removePromise);

            render(
                <PaymentMethodManager
                    {...defaultProps}
                    allowRemove={true}
                    allowSetDefault={true}
                    onRemovePaymentMethod={onRemovePaymentMethod}
                    onSetDefaultPaymentMethod={vi.fn()}
                />
            );

            fireEvent.click(screen.getByTestId('remove-pm_123'));

            await waitFor(() => {
                expect(screen.getByTestId('remove-pm_123')).toBeDisabled();
                expect(screen.getByTestId('set-default-pm_123')).toBeDisabled();
            });

            resolveRemove?.();
        });

        it('should handle remove errors', async () => {
            const onRemovePaymentMethod = vi.fn().mockRejectedValue(new Error('Remove failed'));

            render(<PaymentMethodManager {...defaultProps} allowRemove={true} onRemovePaymentMethod={onRemovePaymentMethod} />);

            fireEvent.click(screen.getByTestId('remove-pm_123'));

            await waitFor(() => {
                expect(screen.getByTestId('payment-method-manager-action-error')).toHaveTextContent('Remove failed');
            });
        });
    });

    describe('set default payment method', () => {
        it('should show set default button for non-default methods', () => {
            const paymentMethods = [createMockPaymentMethod({ id: 'pm_not_default', isDefault: false })];
            render(
                <PaymentMethodManager
                    {...defaultProps}
                    paymentMethods={paymentMethods}
                    allowSetDefault={true}
                    onSetDefaultPaymentMethod={vi.fn()}
                />
            );
            expect(screen.getByTestId('set-default-pm_not_default')).toBeInTheDocument();
        });

        it('should not show set default button for default method', () => {
            const paymentMethods = [createMockPaymentMethod({ id: 'pm_default', isDefault: true })];
            render(
                <PaymentMethodManager
                    {...defaultProps}
                    paymentMethods={paymentMethods}
                    allowSetDefault={true}
                    onSetDefaultPaymentMethod={vi.fn()}
                />
            );
            expect(screen.queryByTestId('set-default-pm_default')).not.toBeInTheDocument();
        });

        it('should not show set default button when allowSetDefault is false', () => {
            render(<PaymentMethodManager {...defaultProps} allowSetDefault={false} onSetDefaultPaymentMethod={vi.fn()} />);
            expect(screen.queryByTestId('set-default-pm_123')).not.toBeInTheDocument();
        });

        it('should not show set default button when no handler provided', () => {
            render(<PaymentMethodManager {...defaultProps} allowSetDefault={true} />);
            expect(screen.queryByTestId('set-default-pm_123')).not.toBeInTheDocument();
        });

        it('should call onSetDefaultPaymentMethod when set default button clicked', async () => {
            const onSetDefaultPaymentMethod = vi.fn().mockResolvedValue(undefined);
            render(<PaymentMethodManager {...defaultProps} allowSetDefault={true} onSetDefaultPaymentMethod={onSetDefaultPaymentMethod} />);

            fireEvent.click(screen.getByTestId('set-default-pm_123'));

            await waitFor(() => {
                expect(onSetDefaultPaymentMethod).toHaveBeenCalledWith('pm_123');
            });
        });

        it('should handle set default errors', async () => {
            const onSetDefaultPaymentMethod = vi.fn().mockRejectedValue(new Error('Set default failed'));

            render(<PaymentMethodManager {...defaultProps} allowSetDefault={true} onSetDefaultPaymentMethod={onSetDefaultPaymentMethod} />);

            fireEvent.click(screen.getByTestId('set-default-pm_123'));

            await waitFor(() => {
                expect(screen.getByTestId('payment-method-manager-action-error')).toHaveTextContent('Set default failed');
            });
        });

        it('should not call handler for already default method', () => {
            const onSetDefaultPaymentMethod = vi.fn().mockResolvedValue(undefined);
            const paymentMethods = [createMockPaymentMethod({ id: 'pm_default', isDefault: true })];
            render(
                <PaymentMethodManager
                    {...defaultProps}
                    paymentMethods={paymentMethods}
                    allowSetDefault={true}
                    onSetDefaultPaymentMethod={onSetDefaultPaymentMethod}
                />
            );

            expect(screen.queryByTestId('set-default-pm_default')).not.toBeInTheDocument();
            expect(onSetDefaultPaymentMethod).not.toHaveBeenCalled();
        });
    });

    describe('multiple payment methods', () => {
        it('should render multiple payment methods', () => {
            const paymentMethods = [
                createMockPaymentMethod({ id: 'pm_1' }),
                createMockPaymentMethod({ id: 'pm_2' }),
                createMockPaymentMethod({ id: 'pm_3' })
            ];
            render(<PaymentMethodManager {...defaultProps} paymentMethods={paymentMethods} />);

            expect(screen.getByTestId('payment-method-pm_1')).toBeInTheDocument();
            expect(screen.getByTestId('payment-method-pm_2')).toBeInTheDocument();
            expect(screen.getByTestId('payment-method-pm_3')).toBeInTheDocument();
        });

        it('should handle actions for specific payment method', async () => {
            const paymentMethods = [
                createMockPaymentMethod({ id: 'pm_1', isDefault: false }),
                createMockPaymentMethod({ id: 'pm_2', isDefault: false })
            ];
            const onSetDefaultPaymentMethod = vi.fn().mockResolvedValue(undefined);

            render(
                <PaymentMethodManager
                    {...defaultProps}
                    paymentMethods={paymentMethods}
                    allowSetDefault={true}
                    onSetDefaultPaymentMethod={onSetDefaultPaymentMethod}
                />
            );

            fireEvent.click(screen.getByTestId('set-default-pm_2'));

            await waitFor(() => {
                expect(onSetDefaultPaymentMethod).toHaveBeenCalledWith('pm_2');
            });
        });
    });

    describe('accessibility', () => {
        it('should have proper button types', () => {
            render(
                <PaymentMethodManager
                    {...defaultProps}
                    allowRemove={true}
                    allowSetDefault={true}
                    onRemovePaymentMethod={vi.fn()}
                    onSetDefaultPaymentMethod={vi.fn()}
                    onAddPaymentMethod={vi.fn()}
                />
            );

            expect(screen.getByTestId('set-default-pm_123')).toHaveAttribute('type', 'button');
            expect(screen.getByTestId('remove-pm_123')).toHaveAttribute('type', 'button');
            expect(screen.getByTestId('add-payment-method-button')).toHaveAttribute('type', 'button');
        });

        it('should have proper disabled state styles', async () => {
            let resolveRemove: () => void;
            const removePromise = new Promise<void>((resolve) => {
                resolveRemove = resolve;
            });
            const onRemovePaymentMethod = vi.fn().mockReturnValue(removePromise);

            render(<PaymentMethodManager {...defaultProps} allowRemove={true} onRemovePaymentMethod={onRemovePaymentMethod} />);

            fireEvent.click(screen.getByTestId('remove-pm_123'));

            await waitFor(() => {
                const button = screen.getByTestId('remove-pm_123');
                expect(button).toBeDisabled();
                expect(button).toHaveStyle({ cursor: 'not-allowed' });
            });

            resolveRemove?.();
        });
    });
});
