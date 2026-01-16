import { type Stripe as StripeJS, loadStripe } from '@stripe/stripe-js';
import { AlertCircle, CheckCircle, CreditCard, Loader2 } from 'lucide-react';
/**
 * Stripe Card Form Component
 * Simplified test card selection for playground
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../stores/config.store';

// Lazy load Stripe instance - cached per publishable key
const stripePromiseCache: Record<string, Promise<StripeJS | null>> = {};

const getStripe = (publishableKey: string) => {
    if (!stripePromiseCache[publishableKey]) {
        stripePromiseCache[publishableKey] = loadStripe(publishableKey);
    }
    return stripePromiseCache[publishableKey];
};

// Test card definitions
interface TestCard {
    id: string;
    number: string;
    label: string;
    description: string;
    status: 'success' | 'error' | 'warning';
    brand: string;
}

const STRIPE_TEST_CARDS: TestCard[] = [
    {
        id: 'success_visa',
        number: '4242424242424242',
        label: 'Visa (Success)',
        description: 'Payment succeeds',
        status: 'success',
        brand: 'visa'
    },
    {
        id: 'success_mastercard',
        number: '5555555555554444',
        label: 'Mastercard (Success)',
        description: 'Payment succeeds',
        status: 'success',
        brand: 'mastercard'
    },
    {
        id: '3ds_required',
        number: '4000000000003220',
        label: '3D Secure Required',
        description: 'Requires authentication',
        status: 'warning',
        brand: 'visa'
    },
    {
        id: 'declined',
        number: '4000000000000002',
        label: 'Card Declined',
        description: 'Payment is declined',
        status: 'error',
        brand: 'visa'
    },
    {
        id: 'insufficient',
        number: '4000000000009995',
        label: 'Insufficient Funds',
        description: 'Not enough balance',
        status: 'error',
        brand: 'visa'
    }
];

// Props interface
export interface StripeCardFormProps {
    amount: number;
    onPaymentMethodCreated: (paymentMethodId: string) => void;
    onError: (error: string) => void;
    triggerPaymentMethod: boolean;
    onPaymentMethodComplete: () => void;
    // For 3DS handling
    clientSecret?: string;
    onPaymentConfirmed?: (status: 'succeeded' | 'failed', error?: string) => void;
}

export function StripeCardForm({
    onPaymentMethodCreated,
    onError,
    triggerPaymentMethod,
    onPaymentMethodComplete,
    clientSecret,
    onPaymentConfirmed
}: StripeCardFormProps) {
    const { t } = useTranslation('simulation');
    const { stripePublishableKey } = useConfigStore();

    const [selectedCard, setSelectedCard] = useState<string>(STRIPE_TEST_CARDS[0].id);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [stripe, setStripe] = useState<StripeJS | null>(null);

    // Initialize Stripe
    useEffect(() => {
        if (!stripePublishableKey || !stripePublishableKey.startsWith('pk_')) {
            return;
        }

        getStripe(stripePublishableKey).then((stripeInstance) => {
            setStripe(stripeInstance);
        });
    }, [stripePublishableKey]);

    // Get selected card data
    const getSelectedCard = useCallback(() => {
        return STRIPE_TEST_CARDS.find((c) => c.id === selectedCard) || STRIPE_TEST_CARDS[0];
    }, [selectedCard]);

    // Create PaymentMethod using test card token
    const createPaymentMethod = useCallback(async () => {
        if (!stripe) {
            onError('Stripe not initialized');
            onPaymentMethodComplete();
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const card = getSelectedCard();

            // Use Stripe's createPaymentMethod with card details
            // In test mode, this works with test card numbers
            const { paymentMethod, error: pmError } = await stripe.createPaymentMethod({
                type: 'card',
                card: {
                    token: `tok_${card.brand}` // Use token shorthand for test cards
                }
            });

            // If token approach fails, we'll need to use the backend
            if (pmError) {
                // Fallback: Send card number to backend to create PaymentMethod
                console.log('[Stripe] Using backend to create PaymentMethod for test card');
                // The PaymentModal will handle this via the card number
                onPaymentMethodCreated(`test_card:${card.number}`);
            } else if (paymentMethod) {
                console.log('[Stripe] PaymentMethod created:', paymentMethod.id);
                onPaymentMethodCreated(paymentMethod.id);
            }
        } catch (_err) {
            // Fallback to sending card number for backend processing
            const card = getSelectedCard();
            console.log('[Stripe] Fallback: sending test card number to backend');
            onPaymentMethodCreated(`test_card:${card.number}`);
        } finally {
            setIsLoading(false);
            onPaymentMethodComplete();
        }
    }, [stripe, getSelectedCard, onPaymentMethodCreated, onError, onPaymentMethodComplete]);

    // Handle 3DS confirmation when clientSecret is provided
    useEffect(() => {
        if (!clientSecret || !stripe || !onPaymentConfirmed) return;

        const confirm3DS = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const { paymentIntent, error: confirmError } = await stripe.confirmCardPayment(clientSecret);

                if (confirmError) {
                    setError(confirmError.message ?? 'Authentication failed');
                    onPaymentConfirmed('failed', confirmError.message);
                } else if (paymentIntent?.status === 'succeeded') {
                    onPaymentConfirmed('succeeded');
                } else {
                    onPaymentConfirmed('failed', `Unexpected status: ${paymentIntent?.status}`);
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Confirmation failed';
                setError(message);
                onPaymentConfirmed('failed', message);
            } finally {
                setIsLoading(false);
            }
        };

        confirm3DS();
    }, [clientSecret, stripe, onPaymentConfirmed]);

    // Watch for payment method trigger
    useEffect(() => {
        if (triggerPaymentMethod && !clientSecret) {
            createPaymentMethod();
        }
    }, [triggerPaymentMethod, clientSecret, createPaymentMethod]);

    // Validation error
    if (!stripePublishableKey) {
        return (
            <div className="p-4 rounded-lg bg-red-900/20 border border-red-500/30">
                <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="h-5 w-5" />
                    <span>{t('subscriptions.payment.stripeNotConfigured', 'Stripe Publishable Key not configured. Add it in Setup.')}</span>
                </div>
            </div>
        );
    }

    if (!stripePublishableKey.startsWith('pk_')) {
        return (
            <div className="p-4 rounded-lg bg-red-900/20 border border-red-500/30">
                <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="h-5 w-5" />
                    <span>
                        {t('subscriptions.payment.invalidPublishableKey', 'Invalid Stripe Publishable Key. It should start with pk_')}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="p-3 rounded-lg bg-red-900/20 border border-red-500/30">
                    <div className="flex items-center gap-2 text-red-400 text-sm">
                        <AlertCircle className="h-4 w-4" />
                        <span>{error}</span>
                    </div>
                </div>
            )}

            {/* Test Card Selection */}
            <fieldset>
                <legend className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                    {t('subscriptions.payment.selectTestCard', 'Select Test Card')}
                </legend>
                <div className="space-y-2" role="radiogroup" aria-label="Test cards">
                    {STRIPE_TEST_CARDS.map((card) => (
                        <button
                            key={card.id}
                            type="button"
                            role="radio"
                            aria-checked={selectedCard === card.id}
                            onClick={() => setSelectedCard(card.id)}
                            disabled={isLoading}
                            className={`w-full p-3 rounded-lg border flex items-center gap-3 transition-all ${
                                selectedCard === card.id ? 'ring-2' : ''
                            }`}
                            style={{
                                backgroundColor: selectedCard === card.id ? 'var(--color-accent-low)' : 'var(--color-surface)',
                                borderColor: selectedCard === card.id ? 'var(--color-accent)' : 'var(--color-border)',
                                opacity: isLoading ? 0.5 : 1
                            }}
                        >
                            <div
                                className={`w-2 h-2 rounded-full ${
                                    card.status === 'success' ? 'bg-green-500' : card.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                            />
                            <CreditCard className="h-5 w-5" style={{ color: 'var(--color-text-muted)' }} />
                            <div className="flex-1 text-left">
                                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                                    {card.label}
                                </p>
                                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                    {card.description}
                                </p>
                            </div>
                            {selectedCard === card.id && <CheckCircle className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />}
                        </button>
                    ))}
                </div>
            </fieldset>

            {/* Selected card info */}
            <div className="p-3 rounded-lg font-mono text-sm" style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Card: </span>
                <span style={{ color: 'var(--color-text)' }}>{getSelectedCard().number}</span>
                <span style={{ color: 'var(--color-text-muted)' }}> | Exp: </span>
                <span style={{ color: 'var(--color-text)' }}>12/34</span>
                <span style={{ color: 'var(--color-text-muted)' }}> | CVV: </span>
                <span style={{ color: 'var(--color-text)' }}>123</span>
            </div>

            {isLoading && (
                <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--color-accent)' }} />
                    <span className="ml-2" style={{ color: 'var(--color-text-muted)' }}>
                        {clientSecret
                            ? t('subscriptions.payment.authenticating', 'Authenticating...')
                            : t('subscriptions.payment.processing', 'Processing...')}
                    </span>
                </div>
            )}

            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {t('subscriptions.payment.stripeTestInfo', 'These are Stripe test cards. No real charges will be made.')}
            </p>
        </div>
    );
}
