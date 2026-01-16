import { AlertCircle, CreditCard, Loader2 } from 'lucide-react';
/**
 * MercadoPago Card Form Component
 * Uses native inputs + SDK createCardToken for tokenization
 * Note: In production, use cardForm with iframes for PCI compliance
 */
import { useCallback, useEffect, useState } from 'react';
import { useConfigStore } from '../stores/config.store';

// MercadoPago SDK types
declare global {
    interface Window {
        MercadoPago: new (publicKey: string, options?: { locale?: string }) => MercadoPagoInstance;
    }
}

interface MercadoPagoInstance {
    createCardToken: (cardData: CardTokenData) => Promise<CardTokenResponse>;
    getPaymentMethods: (params: { bin: string }) => Promise<PaymentMethodsResponse>;
    getIdentificationTypes: () => Promise<IdentificationType[]>;
}

interface CardTokenData {
    cardNumber: string;
    cardholderName: string;
    cardExpirationMonth: string;
    cardExpirationYear: string;
    securityCode: string;
    identificationType?: string;
    identificationNumber?: string;
}

interface CardTokenResponse {
    id: string;
    first_six_digits: string;
    last_four_digits: string;
    expiration_month: number;
    expiration_year: number;
    cardholder: {
        name: string;
        identification?: {
            type: string;
            number: string;
        };
    };
}

interface PaymentMethodsResponse {
    results: Array<{
        id: string;
        name: string;
        payment_type_id: string;
        thumbnail: string;
    }>;
}

interface IdentificationType {
    id: string;
    name: string;
    min_length: number;
    max_length: number;
}

interface PayerIdentification {
    type: string;
    number: string;
}

interface MercadoPagoCardFormProps {
    amount: number;
    onTokenCreated: (token: string, paymentMethodId: string, identification: PayerIdentification) => void;
    onError: (error: string) => void;
    triggerTokenization: boolean;
    onTokenizationComplete: () => void;
}

// MercadoPago test cards
const TEST_CARDS = {
    APPROVED: { number: '5031755734530604', cvv: '123', name: 'APRO' },
    REJECTED: { number: '5031755734530604', cvv: '456', name: 'OTHE' }
};

export function MercadoPagoCardForm({
    amount,
    onTokenCreated,
    onError,
    triggerTokenization,
    onTokenizationComplete
}: MercadoPagoCardFormProps) {
    const { mercadopagoPublicKey } = useConfigStore();

    // Form state
    const [cardNumber, setCardNumber] = useState('');
    const [cardholderName, setCardholderName] = useState('');
    const [expirationDate, setExpirationDate] = useState('');
    const [cvv, setCvv] = useState('');
    const [identificationType, setIdentificationType] = useState('DNI');
    const [identificationNumber, setIdentificationNumber] = useState('12345678');

    // UI state
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [paymentMethodId, setPaymentMethodId] = useState<string>('');
    const [paymentMethodLogo, setPaymentMethodLogo] = useState<string>('');
    const [mpInstance, setMpInstance] = useState<MercadoPagoInstance | null>(null);
    const [identificationTypes, setIdentificationTypes] = useState<IdentificationType[]>([]);

    // Initialize MercadoPago SDK
    useEffect(() => {
        if (!mercadopagoPublicKey) {
            setError('MercadoPago Public Key not configured. Go to Setup and add your Public Key.');
            return;
        }

        if (!window.MercadoPago) {
            setError('MercadoPago SDK not loaded. Try refreshing the page.');
            return;
        }

        try {
            const mp = new window.MercadoPago(mercadopagoPublicKey, { locale: 'es-AR' });
            setMpInstance(mp);

            // Load identification types
            mp.getIdentificationTypes()
                .then((types) => {
                    setIdentificationTypes(types);
                    if (types.length > 0) {
                        setIdentificationType(types[0].id);
                    }
                })
                .catch((err) => {
                    console.warn('[MercadoPago] Could not load identification types:', err);
                });

            console.log('[MercadoPago] SDK initialized successfully');
        } catch (err) {
            console.error('[MercadoPago] Init error:', err);
            setError(err instanceof Error ? err.message : 'Failed to initialize MercadoPago');
        }
    }, [mercadopagoPublicKey]);

    // Detect card type from BIN (first 6 digits)
    const detectCardType = useCallback(
        async (number: string) => {
            if (!mpInstance || number.length < 6) {
                setPaymentMethodId('');
                setPaymentMethodLogo('');
                return;
            }

            const bin = number.replace(/\s/g, '').substring(0, 6);

            try {
                const response = await mpInstance.getPaymentMethods({ bin });
                if (response.results && response.results.length > 0) {
                    const method = response.results[0];
                    setPaymentMethodId(method.id);
                    setPaymentMethodLogo(method.thumbnail);
                }
            } catch (err) {
                console.warn('[MercadoPago] Could not detect card type:', err);
            }
        },
        [mpInstance]
    );

    // Handle card number change
    const handleCardNumberChange = (value: string) => {
        // Format with spaces every 4 digits
        const cleaned = value.replace(/\D/g, '').substring(0, 16);
        const formatted = cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
        setCardNumber(formatted);
        detectCardType(cleaned);
    };

    // Handle expiration date change
    const handleExpirationChange = (value: string) => {
        const cleaned = value.replace(/\D/g, '').substring(0, 4);
        if (cleaned.length >= 2) {
            setExpirationDate(`${cleaned.substring(0, 2)}/${cleaned.substring(2)}`);
        } else {
            setExpirationDate(cleaned);
        }
    };

    // Create token
    const createToken = useCallback(async () => {
        if (!mpInstance) {
            onError('MercadoPago not initialized');
            onTokenizationComplete();
            return;
        }

        // Validate inputs
        const cleanCardNumber = cardNumber.replace(/\s/g, '');
        if (cleanCardNumber.length < 15) {
            onError('Invalid card number');
            onTokenizationComplete();
            return;
        }

        const [expMonth, expYear] = expirationDate.split('/');
        if (!expMonth || !expYear || expMonth.length !== 2 || expYear.length !== 2) {
            onError('Invalid expiration date (use MM/YY)');
            onTokenizationComplete();
            return;
        }

        if (cvv.length < 3) {
            onError('Invalid CVV');
            onTokenizationComplete();
            return;
        }

        if (!cardholderName.trim()) {
            onError('Cardholder name is required');
            onTokenizationComplete();
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const tokenData: CardTokenData = {
                cardNumber: cleanCardNumber,
                cardholderName: cardholderName.trim(),
                cardExpirationMonth: expMonth,
                cardExpirationYear: `20${expYear}`,
                securityCode: cvv,
                identificationType,
                identificationNumber
            };

            console.log('[MercadoPago] Creating token...', {
                cardNumber: `${cleanCardNumber.substring(0, 6)}...`,
                paymentMethodId
            });

            const result = await mpInstance.createCardToken(tokenData);

            console.log('[MercadoPago] Token created:', result.id);
            onTokenCreated(result.id, paymentMethodId || 'card', {
                type: identificationType,
                number: identificationNumber
            });
        } catch (err: unknown) {
            console.error('[MercadoPago] Token error:', err);
            const errorObj = err as { message?: string; cause?: Array<{ description?: string }> };
            const message = errorObj.cause?.[0]?.description || errorObj.message || 'Failed to create token';
            setError(message);
            onError(message);
        } finally {
            setIsLoading(false);
            onTokenizationComplete();
        }
    }, [
        mpInstance,
        cardNumber,
        cardholderName,
        expirationDate,
        cvv,
        identificationType,
        identificationNumber,
        paymentMethodId,
        onTokenCreated,
        onError,
        onTokenizationComplete
    ]);

    // Watch for tokenization trigger
    useEffect(() => {
        if (triggerTokenization) {
            createToken();
        }
    }, [triggerTokenization, createToken]);

    // Fill test card
    const fillTestCard = (type: 'APPROVED' | 'REJECTED') => {
        const card = TEST_CARDS[type];
        handleCardNumberChange(card.number);
        setCardholderName(card.name);
        // Generate a future expiration date (current month + 2 years)
        const now = new Date();
        const futureYear = (now.getFullYear() + 2) % 100; // Get last 2 digits
        const month = String(now.getMonth() + 1).padStart(2, '0');
        setExpirationDate(`${month}/${futureYear}`);
        setCvv(card.cvv);
    };

    if (!mercadopagoPublicKey) {
        return (
            <div className="p-4 rounded-lg bg-red-900/20 border border-red-500/30">
                <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="h-5 w-5" />
                    <span>MercadoPago Public Key not configured. Go to Setup.</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Test Card Buttons */}
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => fillTestCard('APPROVED')}
                    className="text-xs px-3 py-1 rounded bg-green-900/30 text-green-400 hover:bg-green-900/50 transition-colors"
                >
                    Fill Approved Card
                </button>
                <button
                    type="button"
                    onClick={() => fillTestCard('REJECTED')}
                    className="text-xs px-3 py-1 rounded bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors"
                >
                    Fill Rejected Card
                </button>
            </div>

            {error && (
                <div className="p-3 rounded-lg bg-red-900/20 border border-red-500/30">
                    <div className="flex items-center gap-2 text-red-400 text-sm">
                        <AlertCircle className="h-4 w-4" />
                        <span>{error}</span>
                    </div>
                </div>
            )}

            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                {/* Card Number */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Card Number</label>
                    <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <input
                            type="text"
                            value={cardNumber}
                            onChange={(e) => handleCardNumberChange(e.target.value)}
                            placeholder="1234 5678 9012 3456"
                            className="w-full h-10 pl-10 pr-12 rounded-lg border border-gray-600 bg-gray-800 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                            disabled={isLoading}
                        />
                        {paymentMethodLogo && (
                            <img src={paymentMethodLogo} alt={paymentMethodId} className="absolute right-3 top-1/2 -translate-y-1/2 h-6" />
                        )}
                    </div>
                </div>

                {/* Cardholder Name */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Cardholder Name</label>
                    <input
                        type="text"
                        value={cardholderName}
                        onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
                        placeholder="JOHN DOE"
                        className="w-full h-10 px-3 rounded-lg border border-gray-600 bg-gray-800 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                        disabled={isLoading}
                    />
                </div>

                {/* Expiration and CVV */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Expiration</label>
                        <input
                            type="text"
                            value={expirationDate}
                            onChange={(e) => handleExpirationChange(e.target.value)}
                            placeholder="MM/YY"
                            className="w-full h-10 px-3 rounded-lg border border-gray-600 bg-gray-800 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                            disabled={isLoading}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">CVV</label>
                        <input
                            type="text"
                            value={cvv}
                            onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').substring(0, 4))}
                            placeholder="123"
                            className="w-full h-10 px-3 rounded-lg border border-gray-600 bg-gray-800 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                            disabled={isLoading}
                        />
                    </div>
                </div>

                {/* Identification (required for some countries) */}
                {identificationTypes.length > 0 && (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">ID Type</label>
                            <select
                                value={identificationType}
                                onChange={(e) => setIdentificationType(e.target.value)}
                                className="w-full h-10 px-3 rounded-lg border border-gray-600 bg-gray-800 text-white focus:border-blue-500 focus:outline-none"
                                disabled={isLoading}
                            >
                                {identificationTypes.map((type) => (
                                    <option key={type.id} value={type.id}>
                                        {type.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">ID Number</label>
                            <input
                                type="text"
                                value={identificationNumber}
                                onChange={(e) => setIdentificationNumber(e.target.value)}
                                placeholder="12345678"
                                className="w-full h-10 px-3 rounded-lg border border-gray-600 bg-gray-800 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                                disabled={isLoading}
                            />
                        </div>
                    </div>
                )}
            </form>

            {isLoading && (
                <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                    <span className="ml-2 text-gray-400">Processing...</span>
                </div>
            )}

            <p className="text-xs text-gray-500">
                Test cards: Approved (CVV 123) or Rejected (CVV 456). Use "Fill" buttons for valid expiration.
            </p>
        </div>
    );
}
