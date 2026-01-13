/**
 * One-Time Payment Modal Component
 * Allows creating one-time charges for customers using products from catalog or custom amounts
 * Integrates with PaymentModal for card selection
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, DollarSign, ShoppingBag, PencilLine } from 'lucide-react';
import { useConfigStore } from '../../stores/config.store';
import { useCatalogStore } from '../../stores/catalog.store';
import { useEventsStore } from '../../stores/events.store';
import { PaymentModal, type PaymentResult } from './PaymentModal';
import { exportPlaygroundData } from '../../adapters/local-storage.adapter';
import type { QZPayCustomer, QZPayCurrency } from '@qazuor/qzpay-core';

interface OneTimePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedCustomerId?: string;
  onPaymentComplete: () => void;
}

type PaymentSource = 'catalog' | 'custom';

export function OneTimePaymentModal({
  isOpen,
  onClose,
  preselectedCustomerId,
  onPaymentComplete,
}: OneTimePaymentModalProps) {
  const { t: tc } = useTranslation('common');
  const { billing } = useConfigStore();
  const { products, loadCatalog } = useCatalogStore();
  const addEvent = useEventsStore((s) => s.addEvent);

  const [customers, setCustomers] = useState<QZPayCustomer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(preselectedCustomerId || '');

  // Payment source
  const [paymentSource, setPaymentSource] = useState<PaymentSource>('catalog');

  // Product selection
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Custom amount
  const [customAmount, setCustomAmount] = useState('');
  const [customCurrency, setCustomCurrency] = useState<QZPayCurrency>('USD');
  const [customDescription, setCustomDescription] = useState('');

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<{
    customerId: string;
    amount: number;
    currency: string;
    description: string;
    productId?: string;
  } | null>(null);

  // Load customers and products
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      try {
        const data = exportPlaygroundData();
        const customerList = Object.values(data.customers || {}) as QZPayCustomer[];
        setCustomers(customerList);
        loadCatalog();

        // Reset form
        setSelectedCustomerId(preselectedCustomerId || '');
        setPaymentSource('catalog');
        setSelectedProductId('');
        setCustomAmount('');
        setCustomCurrency('USD');
        setCustomDescription('');
        setShowPaymentModal(false);
        setPendingPayment(null);
      } catch (err) {
        console.error('Error loading data:', err);
      }
    };

    loadData();
  }, [isOpen, preselectedCustomerId, loadCatalog]);

  // Get active products
  const activeProducts = products.filter(p => p.active);

  // Get selected product
  const selectedProduct = activeProducts.find(p => p.id === selectedProductId);

  // Format amount for display
  const formatAmount = (cents: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(cents / 100);
  };

  // Parse amount input to cents
  const parseAmountToCents = (value: string): number => {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) return 0;
    return Math.round(parsed * 100);
  };

  // Get current amount and currency based on source
  const getCurrentPaymentDetails = () => {
    if (paymentSource === 'catalog' && selectedProduct) {
      return {
        amount: selectedProduct.unitAmount,
        currency: selectedProduct.currency,
        description: selectedProduct.description || selectedProduct.name,
        productId: selectedProduct.id,
      };
    }
    return {
      amount: parseAmountToCents(customAmount),
      currency: customCurrency,
      description: customDescription || 'One-time charge',
      productId: undefined,
    };
  };

  // Proceed to payment
  const handleProceedToPayment = () => {
    if (!selectedCustomerId) return;

    const details = getCurrentPaymentDetails();
    if (details.amount <= 0) return;

    setPendingPayment({
      customerId: selectedCustomerId,
      amount: details.amount,
      currency: details.currency,
      description: details.description,
      productId: details.productId,
    });
    setShowPaymentModal(true);
  };

  // Handle payment complete
  const handlePaymentComplete = async (result: PaymentResult) => {
    if (!billing || !pendingPayment) return;

    try {
      if (result.status === 'succeeded') {
        // Record the payment
        const paymentId = result.paymentId || `pay_ot_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        await billing.payments.record({
          id: paymentId,
          customerId: pendingPayment.customerId,
          amount: pendingPayment.amount,
          currency: pendingPayment.currency as QZPayCurrency,
          status: 'succeeded',
          metadata: {
            type: 'one_time',
            description: pendingPayment.description,
            productId: pendingPayment.productId,
            source: 'playground',
          },
        });

        // Create invoice for the one-time payment
        const invoice = await billing.invoices.create({
          customerId: pendingPayment.customerId,
          lines: [{
            description: pendingPayment.description,
            quantity: 1,
            unitAmount: pendingPayment.amount,
          }],
          metadata: {
            type: 'one_time',
            productId: pendingPayment.productId,
          },
        });

        // Mark invoice as paid
        await billing.invoices.markPaid(invoice.id, paymentId);

        // Emit payment event
        addEvent({
          type: 'payment.succeeded',
          payload: {
            id: paymentId,
            customerId: pendingPayment.customerId,
            amount: pendingPayment.amount,
            currency: pendingPayment.currency,
            type: 'one_time',
            description: pendingPayment.description,
            productId: pendingPayment.productId,
          },
          timestamp: new Date(),
        });

        // Emit invoice event
        addEvent({
          type: 'invoice.paid',
          payload: {
            id: invoice.id,
            customerId: pendingPayment.customerId,
            amount: pendingPayment.amount,
            currency: pendingPayment.currency,
            paymentId: paymentId,
            type: 'one_time',
          },
          timestamp: new Date(),
        });

        onPaymentComplete();
        onClose();
      } else {
        // Payment failed - emit event
        addEvent({
          type: 'payment.failed',
          payload: {
            customerId: pendingPayment.customerId,
            amount: pendingPayment.amount,
            currency: pendingPayment.currency,
            type: 'one_time',
            description: pendingPayment.description,
            error: result.error,
          },
          timestamp: new Date(),
        });
      }
    } finally {
      setShowPaymentModal(false);
      setPendingPayment(null);
    }
  };

  // Check if can proceed
  const canProceed = () => {
    if (!selectedCustomerId) return false;

    if (paymentSource === 'catalog') {
      return !!selectedProductId;
    }
    return parseAmountToCents(customAmount) > 0;
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const paymentDetails = getCurrentPaymentDetails();

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <DollarSign className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
              One-Time Payment
            </h3>
            <button type="button" onClick={onClose} className="btn btn-ghost p-1">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="modal-body space-y-4">
            {/* Customer Selection */}
            <div>
              <label className="label">Customer</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="input w-full"
              >
                <option value="">Select a customer...</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name || customer.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Source Toggle */}
            <div>
              <label className="label">Payment Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentSource('catalog')}
                  className={`flex-1 p-3 rounded-lg border flex items-center justify-center gap-2 transition-all ${
                    paymentSource === 'catalog' ? 'ring-2' : ''
                  }`}
                  style={{
                    backgroundColor: paymentSource === 'catalog' ? 'var(--color-accent-low)' : 'var(--color-surface)',
                    borderColor: paymentSource === 'catalog' ? 'var(--color-accent)' : 'var(--color-border)',
                  }}
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span style={{ color: 'var(--color-text)' }}>From Catalog</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentSource('custom')}
                  className={`flex-1 p-3 rounded-lg border flex items-center justify-center gap-2 transition-all ${
                    paymentSource === 'custom' ? 'ring-2' : ''
                  }`}
                  style={{
                    backgroundColor: paymentSource === 'custom' ? 'var(--color-accent-low)' : 'var(--color-surface)',
                    borderColor: paymentSource === 'custom' ? 'var(--color-accent)' : 'var(--color-border)',
                  }}
                >
                  <PencilLine className="h-4 w-4" />
                  <span style={{ color: 'var(--color-text)' }}>Custom Amount</span>
                </button>
              </div>
            </div>

            {/* Product Selection (Catalog Mode) */}
            {paymentSource === 'catalog' && (
              <div>
                <label className="label">Product</label>
                {activeProducts.length === 0 ? (
                  <div
                    className="p-4 rounded-lg text-center"
                    style={{ backgroundColor: 'var(--color-surface-elevated)' }}
                  >
                    <ShoppingBag className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
                    <p style={{ color: 'var(--color-text-muted)' }}>
                      No products in catalog
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      Create products in Catalog → Products, or use Custom Amount
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {activeProducts.map(product => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => setSelectedProductId(product.id)}
                        className={`w-full p-3 rounded-lg border text-left transition-all ${
                          selectedProductId === product.id ? 'ring-2' : ''
                        }`}
                        style={{
                          backgroundColor: selectedProductId === product.id ? 'var(--color-accent-low)' : 'var(--color-surface)',
                          borderColor: selectedProductId === product.id ? 'var(--color-accent)' : 'var(--color-border)',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                            {product.name}
                          </span>
                          <span style={{ color: 'var(--color-accent)' }}>
                            {formatAmount(product.unitAmount, product.currency)}
                          </span>
                        </div>
                        {product.description && (
                          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                            {product.description}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Custom Amount Input */}
            {paymentSource === 'custom' && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="label">Amount</label>
                    <div className="relative">
                      <span
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-lg"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        $
                      </span>
                      <input
                        type="number"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className="input w-full pl-8 text-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Currency</label>
                    <select
                      value={customCurrency}
                      onChange={(e) => setCustomCurrency(e.target.value as QZPayCurrency)}
                      className="input w-full"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="ARS">ARS</option>
                      <option value="BRL">BRL</option>
                      <option value="MXN">MXN</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">Description (optional)</label>
                  <input
                    type="text"
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    placeholder="e.g., Consulting fee, Setup charge..."
                    className="input w-full"
                  />
                </div>
              </>
            )}

            {/* Payment Summary */}
            {selectedCustomerId && paymentDetails.amount > 0 && (
              <div
                className="p-3 rounded-lg space-y-2"
                style={{ backgroundColor: 'var(--color-surface-elevated)' }}
              >
                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Customer</span>
                  <span style={{ color: 'var(--color-text)' }}>
                    {selectedCustomer?.name || selectedCustomer?.email}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Item</span>
                  <span style={{ color: 'var(--color-text)' }}>
                    {paymentSource === 'catalog' && selectedProduct
                      ? selectedProduct.name
                      : 'Custom charge'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <span className="font-medium" style={{ color: 'var(--color-text)' }}>Total</span>
                  <span className="text-xl font-bold" style={{ color: 'var(--color-accent)' }}>
                    {formatAmount(paymentDetails.amount, paymentDetails.currency)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              {tc('buttons.cancel')}
            </button>
            <button
              type="button"
              onClick={handleProceedToPayment}
              className="btn btn-primary"
              disabled={!canProceed()}
            >
              <DollarSign className="h-4 w-4" />
              Proceed to Payment
            </button>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {pendingPayment && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setPendingPayment(null);
          }}
          customerId={pendingPayment.customerId}
          amount={pendingPayment.amount}
          currency={pendingPayment.currency}
          description={pendingPayment.description}
          onPaymentComplete={handlePaymentComplete}
        />
      )}
    </>
  );
}
