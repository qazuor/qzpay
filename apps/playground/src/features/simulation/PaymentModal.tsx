import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  CreditCard,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronDown,
  Server,
  AlertTriangle,
} from 'lucide-react';
import { useConfigStore } from '../../stores/config.store';
import { TEST_CARDS, setMockCardNumber } from '../../adapters/mock-payment.adapter';
import { processPaymentInBackend, getCustomerCards, type BackendSavedCard } from '../../lib/backend-client';
import { exportPlaygroundData, savePaymentMethod } from '../../adapters/local-storage.adapter';
import type { PaymentMode } from '../../lib/billing';
import { MercadoPagoCardForm } from '../../components/MercadoPagoCardForm';

// Local saved card type for mock/stripe modes
interface LocalSavedCard {
  id: string;
  customerId: string;
  lastFourDigits: string;
  brand?: string;
  expirationMonth?: number;
  expirationYear?: number;
  isDefault?: boolean;
}

// Payment method types for MercadoPago
type MPPaymentMethod = 'card';

export interface PaymentResult {
  status: 'succeeded' | 'failed';
  paymentId?: string;
  error?: string;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  amount: number;
  currency: string;
  description: string;
  onPaymentComplete: (result: PaymentResult) => void;
  // For trials - only collect card, don't charge
  collectOnly?: boolean;
}

// Test cards by provider
interface TestCardOption {
  value: string;
  labelKey: string;
  status: 'success' | 'error' | 'warning' | 'info';
  extra?: string;
}

const MOCK_TEST_CARDS: TestCardOption[] = [
  { value: TEST_CARDS.SUCCESS, labelKey: 'success', status: 'success' },
  { value: TEST_CARDS.DECLINED, labelKey: 'declined', status: 'error' },
  { value: TEST_CARDS.INSUFFICIENT_FUNDS, labelKey: 'noFunds', status: 'warning' },
  { value: TEST_CARDS.EXPIRED_CARD, labelKey: 'expired', status: 'error' },
  { value: TEST_CARDS.REQUIRES_3DS, labelKey: '3ds', status: 'info' },
  { value: TEST_CARDS.ATTACH_FAILS, labelKey: 'attachFails', status: 'error' },
];

const STRIPE_TEST_CARDS: TestCardOption[] = [
  { value: '4242424242424242', labelKey: 'success', status: 'success', extra: 'Visa' },
  { value: '5555555555554444', labelKey: 'success', status: 'success', extra: 'Mastercard' },
  { value: '4000000000000002', labelKey: 'declined', status: 'error' },
  { value: '4000000000009995', labelKey: 'noFunds', status: 'warning' },
  { value: '4000000000000069', labelKey: 'expired', status: 'error' },
  { value: '4000000000003220', labelKey: '3ds', status: 'info' },
];

const MERCADOPAGO_TEST_CARDS: TestCardOption[] = [
  { value: '5031755734530604', labelKey: 'success', status: 'success', extra: 'AR - CVV: 123' },
  { value: '4509953566233704', labelKey: 'success', status: 'success', extra: 'AR Visa - CVV: 123' },
  { value: '5031755734530604', labelKey: 'declined', status: 'error', extra: 'AR - CVV: 456' },
  { value: '4170068810108020', labelKey: 'success', status: 'success', extra: 'MX - CVV: 123' },
  { value: '5474925432670366', labelKey: 'success', status: 'success', extra: 'BR - CVV: 123' },
];

const getTestCardsForMode = (mode: PaymentMode): TestCardOption[] => {
  switch (mode) {
    case 'stripe':
      return STRIPE_TEST_CARDS;
    case 'mercadopago':
      return MERCADOPAGO_TEST_CARDS;
    default:
      return MOCK_TEST_CARDS;
  }
};

export function PaymentModal({
  isOpen,
  onClose,
  customerId,
  amount,
  currency,
  description,
  onPaymentComplete,
  collectOnly = false,
}: PaymentModalProps) {
  const { t } = useTranslation('simulation');
  const { t: tc } = useTranslation('common');
  const { billing, paymentMode, isBackendConnected, backendSessionId, backendError, getBackendSessionId } = useConfigStore();

  const [selectedCard, setSelectedCard] = useState<string>('0'); // Index or 'custom'
  const [customCardNumber, setCustomCardNumber] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [mpPaymentMethod, setMpPaymentMethod] = useState<MPPaymentMethod>('card');
  const [triggerTokenization, setTriggerTokenization] = useState(false);
  const [cardToken, setCardToken] = useState<string | null>(null);
  const [cardPaymentMethodId, setCardPaymentMethodId] = useState<string | null>(null);
  const [payerIdentification, setPayerIdentification] = useState<{ type: string; number: string } | null>(null);

  // Saved cards state (backend cards for MercadoPago, local cards for mock/stripe)
  const [savedCards, setSavedCards] = useState<BackendSavedCard[]>([]);
  const [localSavedCards, setLocalSavedCards] = useState<LocalSavedCard[]>([]);
  const [selectedSavedCard, setSelectedSavedCard] = useState<string | null>(null);
  const [saveCardForFuture, setSaveCardForFuture] = useState(true);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [savedCardCvv, setSavedCardCvv] = useState('');

  const testCards = getTestCardsForMode(paymentMode);
  const isMercadoPago = paymentMode === 'mercadopago';
  const useMPCardForm = isMercadoPago && isBackendConnected;

  // Get actual card number from selection
  const getCardNumber = (): string => {
    if (selectedCard === 'custom') {
      return customCardNumber;
    }
    const index = parseInt(selectedCard, 10);
    return testCards[index]?.value || testCards[0].value;
  };

  // Load saved cards when modal opens (for all payment modes)
  useEffect(() => {
    const loadSavedCards = async () => {
      if (!isOpen || !customerId) return;

      setIsLoadingCards(true);
      try {
        // For MercadoPago with backend, load from backend
        if (useMPCardForm) {
          const sessionId = backendSessionId || getBackendSessionId();
          const response = await getCustomerCards(sessionId, customerId);
          if (response.success && response.data?.cards) {
            setSavedCards(response.data.cards);
            // If there are saved cards, select the first one by default
            if (response.data.cards.length > 0) {
              setSelectedSavedCard(response.data.cards[0].id);
            }
          }
        } else {
          // For mock/stripe modes, load from local storage
          const data = exportPlaygroundData();
          const paymentMethods = Object.values(data.paymentMethods || {}) as Array<{
            id: string;
            customerId: string;
            card?: {
              last4?: string;
              brand?: string;
              expMonth?: number;
              expYear?: number;
            };
            isDefault?: boolean;
            status?: string;
          }>;

          // Filter cards for this customer that are active
          const customerCards = paymentMethods
            .filter(pm => pm.customerId === customerId && pm.status === 'active' && pm.card)
            .map(pm => ({
              id: pm.id,
              customerId: pm.customerId,
              lastFourDigits: pm.card?.last4 || '****',
              brand: pm.card?.brand,
              expirationMonth: pm.card?.expMonth,
              expirationYear: pm.card?.expYear,
              isDefault: pm.isDefault,
            }));

          setLocalSavedCards(customerCards);
          // If there are saved cards, select the first one by default
          if (customerCards.length > 0) {
            setSelectedSavedCard(customerCards[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load saved cards:', error);
      } finally {
        setIsLoadingCards(false);
      }
    };

    loadSavedCards();
  }, [isOpen, useMPCardForm, customerId, backendSessionId, getBackendSessionId]);

  // Reset state when modal opens and set mock card to success by default
  useEffect(() => {
    if (isOpen) {
      setSelectedCard('0');
      setCustomCardNumber('');
      setResult(null);
      setIsProcessing(false);
      setMpPaymentMethod('card');
      setTriggerTokenization(false);
      setCardToken(null);
      setCardPaymentMethodId(null);
      setPayerIdentification(null);
      setSavedCards([]);
      setLocalSavedCards([]);
      setSelectedSavedCard(null);
      setSaveCardForFuture(true);
      setSavedCardCvv('');
      // Pre-set the mock card to success so first payment works
      setMockCardNumber(testCards[0]?.value || TEST_CARDS.SUCCESS);
    }
  }, [isOpen, testCards]);

  // Handle token received from MercadoPago card form
  const handleTokenCreated = useCallback((token: string, paymentMethodId: string, identification: { type: string; number: string }) => {
    setCardToken(token);
    setCardPaymentMethodId(paymentMethodId);
    setPayerIdentification(identification);
  }, []);

  // Handle tokenization error
  const handleTokenError = useCallback((error: string) => {
    setResult({
      status: 'failed',
      error: `Card tokenization failed: ${error}`,
    });
    setIsProcessing(false);
  }, []);

  // Handle tokenization complete
  const handleTokenizationComplete = useCallback(() => {
    setTriggerTokenization(false);
  }, []);

  // Process payment after token is received
  useEffect(() => {
    if (cardToken && cardPaymentMethodId && payerIdentification && isProcessing) {
      processPaymentWithToken(cardToken, cardPaymentMethodId, payerIdentification);
    }
  }, [cardToken, cardPaymentMethodId, payerIdentification, isProcessing]);

  // Process payment with token (new card)
  const processPaymentWithToken = async (token: string, paymentMethodId: string, identification: { type: string; number: string }) => {
    if (!billing) return;

    try {
      const sessionId = backendSessionId || getBackendSessionId();
      const customerData = await billing.customers.get(customerId);

      const backendResult = await processPaymentInBackend(sessionId, {
        customerId,
        amount,
        currency,
        paymentMethodId,
        token,
        installments: 1,
        saveCard: saveCardForFuture, // Save card for future payments
        payerIdentification: identification, // Required for Argentina
        metadata: { source: 'playground' },
        customer: customerData ? {
          externalId: customerData.externalId,
          email: customerData.email,
          name: customerData.name,
          phone: customerData.phone,
          metadata: customerData.metadata as Record<string, unknown>,
        } : undefined,
      });

      const paymentResult: PaymentResult = {
        status: backendResult.success && backendResult.data?.status === 'succeeded' ? 'succeeded' : 'failed',
        paymentId: backendResult.data?.id,
        error: backendResult.error || backendResult.data?.failureMessage,
      };
      setResult(paymentResult);

      // If card was saved, add it to the list
      if (backendResult.data?.savedCard) {
        setSavedCards(prev => [...prev, backendResult.data!.savedCard!]);
        console.log('Card saved:', backendResult.data.savedCard);
      }

      // Record the payment in frontend storage so it appears in the payment list
      if (paymentResult.status === 'succeeded' && backendResult.data?.id) {
        try {
          await billing.payments.record({
            id: backendResult.data.id,
            customerId,
            amount,
            currency: currency as 'USD' | 'EUR' | 'ARS' | 'MXN' | 'BRL' | 'CLP' | 'COP' | 'PEN' | 'UYU',
            status: 'succeeded',
            providerPaymentId: backendResult.data.id,
            provider: paymentMode,
            metadata: { source: 'playground', paymentMethod: 'card' },
          });
        } catch (recordError) {
          console.warn('Failed to record payment in frontend storage:', recordError);
        }
      }

      if (paymentResult.status === 'succeeded') {
        setTimeout(() => {
          onPaymentComplete(paymentResult);
        }, 1500);
      }
    } catch (error) {
      setResult({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Payment failed',
      });
    } finally {
      setIsProcessing(false);
      setCardToken(null);
      setCardPaymentMethodId(null);
    }
  };

  // Process payment with saved card (creates a new token from card_id + CVV)
  const processPaymentWithSavedCard = async (cardId: string, cvv: string) => {
    if (!billing) return;

    // Validate CVV
    if (!cvv || cvv.length < 3) {
      setResult({
        status: 'failed',
        error: t('subscriptions.payment.invalidCvv', 'Please enter a valid CVV'),
      });
      setIsProcessing(false);
      return;
    }

    try {
      const sessionId = backendSessionId || getBackendSessionId();
      const customerData = await billing.customers.get(customerId);
      const savedCard = savedCards.find(c => c.id === cardId);

      // For MercadoPago, we need to create a new token from the saved card + CVV
      // This is done by the backend which has access to the CardToken API
      const backendResult = await processPaymentInBackend(sessionId, {
        customerId,
        amount,
        currency,
        cardId,
        paymentMethodId: savedCard?.paymentMethodId,
        installments: 1,
        metadata: {
          source: 'playground',
          saved_card_cvv: cvv, // Backend will use this to create a token
        },
        customer: customerData ? {
          externalId: customerData.externalId,
          email: customerData.email,
          name: customerData.name,
          phone: customerData.phone,
          metadata: customerData.metadata as Record<string, unknown>,
        } : undefined,
      });

      const paymentResult: PaymentResult = {
        status: backendResult.success && backendResult.data?.status === 'succeeded' ? 'succeeded' : 'failed',
        paymentId: backendResult.data?.id,
        error: backendResult.error || backendResult.data?.failureMessage,
      };
      setResult(paymentResult);

      // Record the payment in frontend storage so it appears in the payment list
      if (paymentResult.status === 'succeeded' && backendResult.data?.id) {
        try {
          await billing.payments.record({
            id: backendResult.data.id,
            customerId,
            amount,
            currency: currency as 'USD' | 'EUR' | 'ARS' | 'MXN' | 'BRL' | 'CLP' | 'COP' | 'PEN' | 'UYU',
            status: 'succeeded',
            providerPaymentId: backendResult.data.id,
            provider: paymentMode,
            metadata: { source: 'playground', paymentMethod: 'saved_card', cardId },
          });
        } catch (recordError) {
          console.warn('Failed to record payment in frontend storage:', recordError);
        }
      }

      if (paymentResult.status === 'succeeded') {
        setTimeout(() => {
          onPaymentComplete(paymentResult);
        }, 1500);
      }
    } catch (error) {
      setResult({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Payment failed',
      });
    } finally {
      setIsProcessing(false);
      setSavedCardCvv('');
    }
  };

  const formatAmount = (cents: number, curr: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr,
    }).format(cents / 100);
  };

  const handleCardSelect = (value: string) => {
    setSelectedCard(value);
    if (value !== 'custom') {
      const index = parseInt(value, 10);
      const card = testCards[index];
      if (card) {
        setMockCardNumber(card.value);
      }
    }
    setResult(null);
  };

  const handleProcessPayment = async () => {
    if (!billing) return;

    setIsProcessing(true);
    setResult(null);

    // For MercadoPago with a saved card selected, process with CVV
    if (useMPCardForm && selectedSavedCard) {
      await processPaymentWithSavedCard(selectedSavedCard, savedCardCvv);
      return;
    }

    // For MercadoPago with new card, trigger tokenization first
    if (useMPCardForm && !selectedSavedCard) {
      setTriggerTokenization(true);
      // The actual payment will be processed in processPaymentWithToken after token is received
      return;
    }

    const cardNumber = getCardNumber();
    // Set the mock card number for the payment adapter (used as fallback)
    setMockCardNumber(cardNumber);

    try {
      if (collectOnly) {
        // For trials - just validate the card works (simulate)
        // In mock mode, check if the card would succeed
        const isSuccessCard = cardNumber === TEST_CARDS.SUCCESS ||
          !Object.values(TEST_CARDS).includes(cardNumber as typeof TEST_CARDS[keyof typeof TEST_CARDS]);

        if (!isSuccessCard && cardNumber !== TEST_CARDS.REQUIRES_3DS) {
          throw new Error(t('subscriptions.payment.genericError'));
        }

        const paymentResult: PaymentResult = {
          status: 'succeeded',
        };
        setResult(paymentResult);

        // Auto-close after success
        setTimeout(() => {
          onPaymentComplete(paymentResult);
        }, 1500);
      } else if (isBackendConnected) {
        // Use backend for real payment processing (Stripe/MercadoPago)
        const sessionId = backendSessionId || getBackendSessionId();

        // Fetch customer data to sync with backend
        const customerData = await billing?.customers.get(customerId);

        // Determine payment method for MercadoPago (only for card payments now)
        const paymentMethodId = isMercadoPago ? mpPaymentMethod : undefined;

        const backendResult = await processPaymentInBackend(sessionId, {
          customerId,
          amount,
          currency,
          paymentMethodId,
          metadata: { source: 'playground' },
          // Pass customer data so backend can sync before payment
          customer: customerData ? {
            externalId: customerData.externalId,
            email: customerData.email,
            name: customerData.name,
            phone: customerData.phone,
            metadata: customerData.metadata as Record<string, unknown>,
          } : undefined,
        });

        const paymentResult: PaymentResult = {
          status: backendResult.success && backendResult.data?.status === 'succeeded' ? 'succeeded' : 'failed',
          paymentId: backendResult.data?.id,
          error: backendResult.error || backendResult.data?.failureMessage,
        };
        setResult(paymentResult);

        // Record the payment in frontend storage so it appears in the payment list
        if (paymentResult.status === 'succeeded' && backendResult.data?.id) {
          try {
            await billing.payments.record({
              id: backendResult.data.id,
              customerId,
              amount,
              currency: currency as 'USD' | 'EUR' | 'ARS' | 'MXN' | 'BRL' | 'CLP' | 'COP' | 'PEN' | 'UYU',
              status: 'succeeded',
              providerPaymentId: backendResult.data.id,
              provider: paymentMode,
              metadata: { source: 'playground' },
            });
          } catch (recordError) {
            console.warn('Failed to record payment in frontend storage:', recordError);
          }
        }

        if (paymentResult.status === 'succeeded') {
          // Auto-close after success
          setTimeout(() => {
            onPaymentComplete(paymentResult);
          }, 1500);
        }
      } else {
        // Process payment using local mock adapter
        const payment = await billing.payments.process({
          customerId,
          amount,
          currency: currency as 'USD' | 'EUR' | 'ARS' | 'MXN' | 'BRL' | 'CLP' | 'COP' | 'PEN' | 'UYU',
          metadata: { cardNumber },
        });

        const paymentResult: PaymentResult = {
          status: payment.status === 'succeeded' ? 'succeeded' : 'failed',
          paymentId: payment.id,
          error: payment.status === 'failed'
            ? (payment.failureMessage ?? t('subscriptions.payment.genericError'))
            : undefined,
        };
        setResult(paymentResult);

        // Save card for future use if payment succeeded and user opted in
        if (paymentResult.status === 'succeeded' && saveCardForFuture && !selectedSavedCard) {
          try {
            // Extract last 4 digits from card number
            const last4 = cardNumber.slice(-4);
            // Determine brand from first digit
            const firstDigit = cardNumber[0];
            const brand = firstDigit === '4' ? 'Visa' : firstDigit === '5' ? 'Mastercard' : firstDigit === '3' ? 'Amex' : 'Card';

            // Create payment method in storage
            const paymentMethodId = `pm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            savePaymentMethod({
              id: paymentMethodId,
              customerId,
              type: 'card',
              card: {
                last4,
                brand,
                expMonth: 12,
                expYear: new Date().getFullYear() + 3,
              },
              isDefault: localSavedCards.length === 0, // Set as default if first card
            });

            // Add to local state
            setLocalSavedCards(prev => [...prev, {
              id: paymentMethodId,
              customerId,
              lastFourDigits: last4,
              brand,
              expirationMonth: 12,
              expirationYear: new Date().getFullYear() + 3,
              isDefault: localSavedCards.length === 0,
            }]);
          } catch (saveError) {
            console.warn('Failed to save card for future use:', saveError);
          }
        }

        if (paymentResult.status === 'succeeded') {
          // Auto-close after success
          setTimeout(() => {
            onPaymentComplete(paymentResult);
          }, 1500);
        }
      }
    } catch (error) {
      const paymentResult: PaymentResult = {
        status: 'failed',
        error: error instanceof Error ? error.message : t('subscriptions.payment.genericError'),
      };
      setResult(paymentResult);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetry = () => {
    setResult(null);
    setSelectedCard('0');
    setCustomCardNumber('');
    setMockCardNumber(testCards[0]?.value || TEST_CARDS.SUCCESS);
  };

  const handleClose = () => {
    if (result?.status === 'failed') {
      onPaymentComplete(result);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            {collectOnly
              ? t('subscriptions.payment.titleCollect')
              : t('subscriptions.payment.title')}
          </h3>
          <button type="button" onClick={handleClose} className="btn btn-ghost p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="modal-body space-y-4">
          {/* Backend Status Indicator */}
          {paymentMode !== 'mock' && (
            <div
              className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
                isBackendConnected
                  ? 'bg-green-900/20 border border-green-500/30'
                  : 'bg-yellow-900/20 border border-yellow-500/30'
              }`}
            >
              {isBackendConnected ? (
                <>
                  <Server className="h-4 w-4 text-green-400" />
                  <span className="text-green-400">
                    {t('subscriptions.payment.backendConnected', { provider: paymentMode })}
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                  <span className="text-yellow-400">
                    {backendError || t('subscriptions.payment.backendFallback')}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Amount Display */}
          {!collectOnly && (
            <div
              className="text-center p-4 rounded-lg"
              style={{ backgroundColor: 'var(--color-surface-elevated)' }}
            >
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {t('subscriptions.payment.amount')}
              </p>
              <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
                {formatAmount(amount, currency)}
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                {description}
              </p>
            </div>
          )}

          {collectOnly && (
            <div
              className="p-4 rounded-lg"
              style={{ backgroundColor: 'var(--color-surface-elevated)' }}
            >
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {t('subscriptions.payment.collectOnlyInfo')}
              </p>
            </div>
          )}

          {/* Result Display */}
          {result && (
            <div
              className={`p-4 rounded-lg flex items-center gap-3 ${
                result.status === 'succeeded'
                  ? 'bg-green-900/20 border border-green-500/30'
                  : 'bg-red-900/20 border border-red-500/30'
              }`}
            >
              {result.status === 'succeeded' ? (
                <>
                  <CheckCircle className="h-6 w-6 text-green-400 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-green-400">
                      {t('subscriptions.payment.success')}
                    </p>
                    {result.paymentId && (
                      <p className="text-xs text-green-400/70 font-mono">
                        {result.paymentId}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-6 w-6 text-red-400 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-red-400">
                      {t('subscriptions.payment.failed')}
                    </p>
                    <p className="text-sm text-red-400/70">{result.error}</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* MercadoPago Payment Options - Show when backend connected */}
          {!result && useMPCardForm && (
            <div className="space-y-4">
              {/* Loading saved cards */}
              {isLoadingCards && (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                  <span className="ml-2 text-gray-400">{t('subscriptions.payment.loadingCards', 'Loading saved cards...')}</span>
                </div>
              )}

              {/* Saved Cards Section */}
              {!isLoadingCards && savedCards.length > 0 && (
                <div className="space-y-3">
                  <label className="label">{t('subscriptions.payment.savedCards', 'Saved Cards')}</label>
                  <div className="space-y-2">
                    {savedCards.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => {
                          setSelectedSavedCard(card.id);
                          setSavedCardCvv('');
                        }}
                        className={`w-full p-3 rounded-lg border flex items-center gap-3 transition-colors ${
                          selectedSavedCard === card.id
                            ? 'border-blue-500 bg-blue-900/20'
                            : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                        }`}
                      >
                        {card.paymentMethodThumbnail ? (
                          <img src={card.paymentMethodThumbnail} alt={card.paymentMethodName || 'Card'} className="h-6" />
                        ) : (
                          <CreditCard className="h-5 w-5 text-gray-400" />
                        )}
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium text-white">
                            {card.paymentMethodName || 'Card'} ****{card.lastFourDigits}
                          </p>
                          <p className="text-xs text-gray-400">
                            {t('subscriptions.payment.expires', 'Expires')} {card.expirationMonth.toString().padStart(2, '0')}/{card.expirationYear}
                          </p>
                        </div>
                        {selectedSavedCard === card.id && (
                          <CheckCircle className="h-5 w-5 text-blue-400" />
                        )}
                      </button>
                    ))}

                    {/* Option to use a new card */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSavedCard(null);
                        setSavedCardCvv('');
                      }}
                      className={`w-full p-3 rounded-lg border flex items-center gap-3 transition-colors ${
                        selectedSavedCard === null
                          ? 'border-blue-500 bg-blue-900/20'
                          : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                      }`}
                    >
                      <CreditCard className="h-5 w-5 text-gray-400" />
                      <span className="text-sm font-medium text-white">
                        {t('subscriptions.payment.useNewCard', 'Use a new card')}
                      </span>
                      {selectedSavedCard === null && (
                        <CheckCircle className="h-5 w-5 text-blue-400 ml-auto" />
                      )}
                    </button>
                  </div>

                  {/* CVV input for saved card */}
                  {selectedSavedCard && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        {t('subscriptions.payment.cvvForSavedCard', 'Security Code (CVV)')}
                      </label>
                      <input
                        type="text"
                        value={savedCardCvv}
                        onChange={(e) => setSavedCardCvv(e.target.value.replace(/\D/g, '').substring(0, 4))}
                        placeholder="123"
                        className="w-32 h-10 px-3 rounded-lg border border-gray-600 bg-gray-800 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                        disabled={isProcessing}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {t('subscriptions.payment.cvvRequired', 'Required for security')}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* New Card Form - Show when no saved card selected or no saved cards */}
              {!isLoadingCards && (savedCards.length === 0 || selectedSavedCard === null) && (
                <>
                  <MercadoPagoCardForm
                    amount={amount}
                    onTokenCreated={handleTokenCreated}
                    onError={handleTokenError}
                    triggerTokenization={triggerTokenization}
                    onTokenizationComplete={handleTokenizationComplete}
                  />

                  {/* Save card checkbox */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="saveCard"
                      checked={saveCardForFuture}
                      onChange={(e) => setSaveCardForFuture(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                    />
                    <label htmlFor="saveCard" className="text-sm text-gray-300">
                      {t('subscriptions.payment.saveCardForFuture', 'Save this card for future payments')}
                    </label>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Test Card Selection - Show for mock/stripe or MP without backend */}
          {!result && !useMPCardForm && (
            <div className="space-y-4">
              {/* Loading saved cards */}
              {isLoadingCards && (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--color-accent)' }} />
                  <span className="ml-2" style={{ color: 'var(--color-text-muted)' }}>
                    {t('subscriptions.payment.loadingCards', 'Loading saved cards...')}
                  </span>
                </div>
              )}

              {/* Saved Cards Section - Show when customer has saved cards */}
              {!isLoadingCards && localSavedCards.length > 0 && (
                <div className="space-y-3">
                  <label className="label">{t('subscriptions.payment.savedCards', 'Saved Cards')}</label>
                  <div className="space-y-2">
                    {localSavedCards.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => {
                          setSelectedSavedCard(card.id);
                        }}
                        className={`w-full p-3 rounded-lg border flex items-center gap-3 transition-all ${
                          selectedSavedCard === card.id ? 'ring-2' : ''
                        }`}
                        style={{
                          backgroundColor: selectedSavedCard === card.id ? 'var(--color-accent-low)' : 'var(--color-surface)',
                          borderColor: selectedSavedCard === card.id ? 'var(--color-accent)' : 'var(--color-border)',
                        }}
                      >
                        <CreditCard className="h-5 w-5" style={{ color: 'var(--color-text-muted)' }} />
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                            {card.brand || 'Card'} ****{card.lastFourDigits}
                          </p>
                          {card.expirationMonth && card.expirationYear && (
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                              {t('subscriptions.payment.expires', 'Expires')} {card.expirationMonth.toString().padStart(2, '0')}/{card.expirationYear}
                            </p>
                          )}
                        </div>
                        {selectedSavedCard === card.id && (
                          <CheckCircle className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                        )}
                      </button>
                    ))}

                    {/* Option to use a new card */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSavedCard(null);
                      }}
                      className={`w-full p-3 rounded-lg border flex items-center gap-3 transition-all ${
                        selectedSavedCard === null ? 'ring-2' : ''
                      }`}
                      style={{
                        backgroundColor: selectedSavedCard === null ? 'var(--color-accent-low)' : 'var(--color-surface)',
                        borderColor: selectedSavedCard === null ? 'var(--color-accent)' : 'var(--color-border)',
                      }}
                    >
                      <CreditCard className="h-5 w-5" style={{ color: 'var(--color-text-muted)' }} />
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                        {t('subscriptions.payment.useNewCard', 'Use a new card')}
                      </span>
                      {selectedSavedCard === null && (
                        <CheckCircle className="h-5 w-5 ml-auto" style={{ color: 'var(--color-accent)' }} />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* New card / Test card selection - Show when no saved cards or using new card */}
              {!isLoadingCards && (localSavedCards.length === 0 || selectedSavedCard === null) && (
                <>
                  <div>
                    <label htmlFor="cardSelect" className="label">
                      {t('subscriptions.payment.selectCard')}
                    </label>
                    <div className="relative">
                      <CreditCard
                        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-10"
                        style={{ color: 'var(--color-text-muted)' }}
                      />
                      <select
                        id="cardSelect"
                        value={selectedCard}
                        onChange={(e) => handleCardSelect(e.target.value)}
                        className="input pl-10 pr-10 appearance-none cursor-pointer"
                      >
                        {testCards.map((card, index) => {
                          const statusIcon = card.status === 'success' ? '✓' : card.status === 'error' ? '✗' : card.status === 'warning' ? '!' : 'ℹ';
                          const label = t(`subscriptions.payment.cards.${card.labelKey}`);
                          const extra = card.extra ? ` (${card.extra})` : '';
                          return (
                            <option key={`${card.value}-${index}`} value={index.toString()}>
                              {statusIcon} {label} - {card.value}{extra}
                            </option>
                          );
                        })}
                        <option value="custom">
                          ✎ {t('subscriptions.payment.customCard')}
                        </option>
                      </select>
                      <ChevronDown
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                        style={{ color: 'var(--color-text-muted)' }}
                      />
                    </div>
                  </div>

                  {/* Custom card input - only shown when custom is selected */}
                  {selectedCard === 'custom' && (
                    <div>
                      <label htmlFor="customCardNumber" className="label">
                        {t('subscriptions.payment.cardNumber')}
                      </label>
                      <div className="relative">
                        <CreditCard
                          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                          style={{ color: 'var(--color-text-muted)' }}
                        />
                        <input
                          id="customCardNumber"
                          type="text"
                          value={customCardNumber}
                          onChange={(e) => {
                            setCustomCardNumber(e.target.value);
                            setMockCardNumber(e.target.value);
                          }}
                          className="input pl-10 font-mono"
                          placeholder="4242 4242 4242 4242"
                        />
                      </div>
                    </div>
                  )}

                  {/* Show selected card number */}
                  {selectedCard !== 'custom' && (
                    <div
                      className="p-3 rounded-lg font-mono text-sm"
                      style={{ backgroundColor: 'var(--color-surface-elevated)' }}
                    >
                      <span style={{ color: 'var(--color-text-muted)' }}>
                        {t('subscriptions.payment.cardNumber')}:{' '}
                      </span>
                      <span style={{ color: 'var(--color-text)' }}>
                        {testCards[parseInt(selectedCard, 10)]?.value}
                      </span>
                      {testCards[parseInt(selectedCard, 10)]?.extra && (
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {' '}({testCards[parseInt(selectedCard, 10)]?.extra})
                        </span>
                      )}
                    </div>
                  )}

                  {/* Save card checkbox */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="saveCardMock"
                      checked={saveCardForFuture}
                      onChange={(e) => setSaveCardForFuture(e.target.checked)}
                      className="h-4 w-4 rounded"
                      style={{ accentColor: 'var(--color-accent)' }}
                    />
                    <label htmlFor="saveCardMock" className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {t('subscriptions.payment.saveCardForFuture', 'Save this card for future payments')}
                    </label>
                  </div>

                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {t('subscriptions.payment.cardHelp')}
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {result?.status === 'failed' ? (
            <>
              <button type="button" onClick={handleClose} className="btn btn-secondary">
                {tc('buttons.cancel')}
              </button>
              <button type="button" onClick={handleRetry} className="btn btn-primary">
                {t('subscriptions.payment.retry')}
              </button>
            </>
          ) : result?.status === 'succeeded' ? (
            <button type="button" onClick={handleClose} className="btn btn-primary w-full">
              <CheckCircle className="h-4 w-4" />
              {tc('buttons.continue')}
            </button>
          ) : (
            <>
              <button type="button" onClick={handleClose} className="btn btn-secondary">
                {tc('buttons.cancel')}
              </button>
              <button
                type="button"
                onClick={handleProcessPayment}
                className="btn btn-primary"
                disabled={isProcessing || (selectedCard === 'custom' && !customCardNumber) || (useMPCardForm && selectedSavedCard !== null && savedCardCvv.length < 3)}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('subscriptions.payment.processing')}
                  </>
                ) : collectOnly ? (
                  <>
                    <CreditCard className="h-4 w-4" />
                    {t('subscriptions.payment.saveCard')}
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    {t('subscriptions.payment.pay', { amount: formatAmount(amount, currency) })}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
