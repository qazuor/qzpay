/**
 * Backend API Client for QZPay Playground
 *
 * This client communicates with the local backend server for real payment
 * provider API calls (Stripe, MercadoPago).
 */

const BACKEND_URL = 'http://localhost:3010';

export interface BackendInitConfig {
  mode: 'stripe' | 'mercadopago';
  stripeSecretKey?: string;
  mercadopagoAccessToken?: string;
  sessionId: string;
}

export interface BackendCustomer {
  externalId: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  metadata?: Record<string, unknown>;
}

export interface BackendPaymentRequest {
  customerId: string;
  amount: number;
  currency: string;
  paymentMethodId?: string;
  token?: string;
  cardId?: string;
  installments?: number;
  metadata?: Record<string, unknown>;
  saveCard?: boolean;
  // Payer identification (required for Argentina)
  payerIdentification?: {
    type: string;
    number: string;
  };
  // Customer data to sync before payment
  customer?: {
    externalId: string;
    email: string;
    name?: string | null;
    phone?: string | null;
    metadata?: Record<string, unknown>;
  };
}

export interface BackendSavedCard {
  id: string;
  provider: string;
  lastFourDigits: string;
  firstSixDigits?: string;
  expirationMonth: number;
  expirationYear: number;
  cardholderName?: string;
  paymentMethodId?: string;
  paymentMethodName?: string;
  paymentMethodThumbnail?: string;
  createdAt: Date;
}

export interface BackendPaymentResult {
  id: string;
  status: 'succeeded' | 'pending' | 'failed';
  amount: number;
  currency: string;
  failureMessage?: string;
  savedCard?: BackendSavedCard;
}

export interface BackendResponse<T> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * Generate a unique session ID for this browser session
 */
export function generateSessionId(): string {
  const stored = sessionStorage.getItem('qzpay_session_id');
  if (stored) return stored;

  const newId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  sessionStorage.setItem('qzpay_session_id', newId);
  return newId;
}

/**
 * Check if backend is available
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    console.log(`[QZPay] Checking backend health at ${BACKEND_URL}/health`);
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    console.log(`[QZPay] Backend health response: ${response.status} ${response.ok}`);
    return response.ok;
  } catch (error) {
    console.error(`[QZPay] Backend health check failed:`, error);
    return false;
  }
}

/**
 * Initialize backend billing session
 */
export async function initBackendSession(config: BackendInitConfig): Promise<BackendResponse<{ provider: string }>> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to initialize backend session' };
    }

    return { success: true, data: { provider: data.provider } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Backend connection failed',
    };
  }
}

/**
 * Sync customer with payment provider
 */
export async function syncCustomerToBackend(
  sessionId: string,
  customer: BackendCustomer
): Promise<BackendResponse<{ customerId: string; providerCustomerId: string }>> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/customers/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, customer }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to sync customer' };
    }

    return {
      success: true,
      data: {
        customerId: data.customer.id,
        providerCustomerId: data.customer.providerCustomerId,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Backend connection failed',
    };
  }
}

/**
 * Create customer in payment provider
 */
export async function createCustomerInBackend(
  sessionId: string,
  email: string,
  name?: string,
  metadata?: Record<string, unknown>
): Promise<BackendResponse<{ customer: unknown }>> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/customers/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, email, name, metadata }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to create customer' };
    }

    return { success: true, data: { customer: data.customer } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Backend connection failed',
    };
  }
}

/**
 * Process payment through backend
 */
export async function processPaymentInBackend(
  sessionId: string,
  request: BackendPaymentRequest
): Promise<BackendResponse<BackendPaymentResult>> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/payments/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, ...request }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Payment failed' };
    }

    return {
      success: data.success,
      data: {
        ...data.payment,
        savedCard: data.savedCard,
      },
      error: data.success ? undefined : data.payment?.failureMessage || 'Payment failed',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Backend connection failed',
    };
  }
}

/**
 * Check if session is initialized in backend
 */
export async function checkBackendSession(sessionId: string): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/session/${sessionId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    return data.initialized === true;
  } catch {
    return false;
  }
}

/**
 * Cleanup backend session
 */
export async function cleanupBackendSession(sessionId: string): Promise<void> {
  try {
    await fetch(`${BACKEND_URL}/api/session/${sessionId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Get saved cards for a customer
 */
export async function getCustomerCards(
  sessionId: string,
  customerId: string
): Promise<BackendResponse<{ cards: BackendSavedCard[] }>> {
  try {
    const response = await fetch(
      `${BACKEND_URL}/api/customers/${customerId}/cards?sessionId=${sessionId}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to get cards' };
    }

    return { success: true, data: { cards: data.cards || [] } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Backend connection failed',
    };
  }
}

/**
 * Delete a saved card
 */
export async function deleteCustomerCard(
  sessionId: string,
  customerId: string,
  cardId: string
): Promise<BackendResponse<void>> {
  try {
    const response = await fetch(
      `${BACKEND_URL}/api/customers/${customerId}/cards/${cardId}?sessionId=${sessionId}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to delete card' };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Backend connection failed',
    };
  }
}
