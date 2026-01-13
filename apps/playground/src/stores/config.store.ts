/**
 * Configuration Store
 * Manages payment mode, API keys, billing initialization, and extended settings
 */
import type { QZPayBilling, QZPayEventMap, QZPayCurrency, QZPayBillingInterval } from '@qazuor/qzpay-core';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  createPlaygroundBilling,
  type PaymentMode,
  resetBilling,
} from '../lib/billing';
import {
  generateSessionId,
  initBackendSession,
  checkBackendHealth,
  cleanupBackendSession,
} from '../lib/backend-client';
import { useEventsStore } from './events.store';

/**
 * Simulation behavior configuration
 */
export interface SimulationConfig {
  /** Process payments instantly vs with delay */
  autoProcessPayments: boolean;
  /** Delay in ms for simulated webhook events (0-5000) */
  simulatedWebhookDelay: number;
  /** Percentage of payments that randomly fail (0-100) */
  paymentFailureRate: number;
  /** Auto-convert trials to paid or require action */
  trialAutoConvert: boolean;
}

/**
 * Time simulation for testing subscription renewals
 */
export interface TimeSimulationState {
  /** Whether time simulation is enabled */
  enabled: boolean;
  /** The simulated current date (null = use real time) */
  simulatedDate: Date | null;
  /** Speed multiplier for time (1 = normal, 60 = 1 minute = 1 hour) */
  speedMultiplier: number;
}

/**
 * Display preferences configuration
 */
export interface DisplayConfig {
  /** Show full IDs or truncated versions */
  showFullIds: boolean;
  /** Date format preference */
  dateFormat: 'short' | 'long' | 'iso';
  /** Currency display style */
  currencyDisplay: 'symbol' | 'code' | 'name';
}

/**
 * Default values configuration
 */
export interface DefaultsConfig {
  /** Default currency for new prices */
  currency: QZPayCurrency;
  /** Default billing interval */
  billingInterval: QZPayBillingInterval;
  /** Default trial days (0 = no trial) */
  trialDays: number;
  /** Default days until invoice is due */
  invoiceDaysUntilDue: number;
}

interface ConfigState {
  // Payment mode configuration
  paymentMode: PaymentMode;
  stripeSecretKey: string;
  mercadopagoAccessToken: string;
  mercadopagoPublicKey: string;

  // Billing instance state
  billing: QZPayBilling | null;
  isInitialized: boolean;
  isInitializing: boolean;
  initError: string | null;

  // Backend state (for real provider modes)
  backendSessionId: string | null;
  isBackendConnected: boolean;
  backendError: string | null;

  // Extended configuration
  simulation: SimulationConfig;
  display: DisplayConfig;
  defaults: DefaultsConfig;

  // Time simulation state
  timeSimulation: TimeSimulationState;

  // Actions
  setPaymentMode: (mode: PaymentMode) => void;
  setStripeSecretKey: (key: string) => void;
  setMercadopagoAccessToken: (token: string) => void;
  setMercadopagoPublicKey: (key: string) => void;
  initializeBilling: () => Promise<void>;
  resetConfig: () => void;

  // Backend actions
  getBackendSessionId: () => string;

  // Extended config actions
  setSimulationConfig: (config: Partial<SimulationConfig>) => void;
  setDisplayConfig: (config: Partial<DisplayConfig>) => void;
  setDefaultsConfig: (config: Partial<DefaultsConfig>) => void;

  // Time simulation actions
  enableTimeSimulation: () => void;
  disableTimeSimulation: () => void;
  setSimulatedDate: (date: Date) => void;
  advanceTime: (days: number) => void;
  getCurrentTime: () => Date;
}

// Default values for extended configuration
const defaultSimulation: SimulationConfig = {
  autoProcessPayments: true,
  simulatedWebhookDelay: 0,
  paymentFailureRate: 0,
  trialAutoConvert: true,
};

const defaultDisplay: DisplayConfig = {
  showFullIds: false,
  dateFormat: 'short',
  currencyDisplay: 'symbol',
};

const defaultDefaults: DefaultsConfig = {
  currency: 'USD',
  billingInterval: 'month',
  trialDays: 0,
  invoiceDaysUntilDue: 30,
};

const defaultTimeSimulation: TimeSimulationState = {
  enabled: false,
  simulatedDate: null,
  speedMultiplier: 1,
};

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      // Initial state
      paymentMode: 'mock',
      stripeSecretKey: '',
      mercadopagoAccessToken: '',
      mercadopagoPublicKey: '',
      billing: null,
      isInitialized: false,
      isInitializing: false,
      initError: null,

      // Backend state initial values
      backendSessionId: null,
      isBackendConnected: false,
      backendError: null,

      // Extended configuration initial state
      simulation: defaultSimulation,
      display: defaultDisplay,
      defaults: defaultDefaults,

      // Time simulation initial state
      timeSimulation: defaultTimeSimulation,

      // Actions
      setPaymentMode: (mode) => {
        set({ paymentMode: mode });
        // Re-initialize if already initialized
        if (get().isInitialized) {
          get().initializeBilling();
        }
      },

      setStripeSecretKey: (key) => {
        set({ stripeSecretKey: key });
      },

      setMercadopagoAccessToken: (token) => {
        set({ mercadopagoAccessToken: token });
      },

      setMercadopagoPublicKey: (key) => {
        set({ mercadopagoPublicKey: key });
      },

      getBackendSessionId: () => {
        const state = get();
        if (state.backendSessionId) return state.backendSessionId;

        const newSessionId = generateSessionId();
        set({ backendSessionId: newSessionId });
        return newSessionId;
      },

      initializeBilling: async () => {
        const state = get();

        // Don't re-initialize if already initializing
        if (state.isInitializing) return;

        set({ isInitializing: true, initError: null, backendError: null });

        try {
          // Reset existing billing instance
          resetBilling();

          // Cleanup existing backend session if any
          if (state.backendSessionId) {
            await cleanupBackendSession(state.backendSessionId);
          }

          // For real provider modes, initialize backend session
          const isRealProvider = state.paymentMode === 'stripe' || state.paymentMode === 'mercadopago';

          if (isRealProvider) {
            // Check if backend is available
            const backendAvailable = await checkBackendHealth();

            if (!backendAvailable) {
              set({
                isBackendConnected: false,
                backendError: 'Backend server not running. Start the server with `pnpm dev` or use Mock mode.',
              });
              // Continue with mock adapter as fallback
              console.warn('[QZPay Playground] Backend not available, falling back to mock adapter');
            } else {
              // Initialize backend session
              const sessionId = get().getBackendSessionId();
              const result = await initBackendSession({
                mode: state.paymentMode as 'stripe' | 'mercadopago',
                stripeSecretKey: state.paymentMode === 'stripe' ? state.stripeSecretKey : undefined,
                mercadopagoAccessToken: state.paymentMode === 'mercadopago' ? state.mercadopagoAccessToken : undefined,
                sessionId,
              });

              if (result.success) {
                set({ isBackendConnected: true, backendError: null });
                console.info(`[QZPay Playground] Backend connected for ${state.paymentMode} mode`);
              } else {
                set({
                  isBackendConnected: false,
                  backendError: result.error || 'Failed to initialize backend session',
                });
                console.warn('[QZPay Playground] Backend initialization failed:', result.error);
              }
            }
          } else {
            // Mock mode doesn't need backend
            set({ isBackendConnected: false, backendError: null });
          }

          // Create event handler that forwards to events store
          const handleEvent = <K extends keyof QZPayEventMap>(
            eventType: K,
            payload: QZPayEventMap[K]
          ) => {
            useEventsStore.getState().addEvent({
              type: eventType,
              payload: payload as unknown as Record<string, unknown>,
              timestamp: new Date(),
            });
          };

          // Create billing instance (always uses mock adapter in browser)
          // Real API calls go through the backend when isBackendConnected is true
          const billing = await createPlaygroundBilling({
            mode: state.paymentMode,
            stripeSecretKey:
              state.paymentMode === 'stripe' ? state.stripeSecretKey : undefined,
            mercadopagoAccessToken:
              state.paymentMode === 'mercadopago'
                ? state.mercadopagoAccessToken
                : undefined,
            onEvent: handleEvent,
          });

          set({
            billing,
            isInitialized: true,
            isInitializing: false,
            initError: null,
          });
        } catch (error) {
          set({
            billing: null,
            isInitialized: false,
            isInitializing: false,
            initError:
              error instanceof Error
                ? error.message
                : 'Failed to initialize billing',
          });
        }
      },

      resetConfig: () => {
        const state = get();
        // Cleanup backend session
        if (state.backendSessionId) {
          cleanupBackendSession(state.backendSessionId);
        }
        resetBilling();
        set({
          paymentMode: 'mock',
          stripeSecretKey: '',
          mercadopagoAccessToken: '',
          mercadopagoPublicKey: '',
          billing: null,
          isInitialized: false,
          isInitializing: false,
          initError: null,
          backendSessionId: null,
          isBackendConnected: false,
          backendError: null,
          simulation: defaultSimulation,
          display: defaultDisplay,
          defaults: defaultDefaults,
          timeSimulation: defaultTimeSimulation,
        });
      },

      // Extended configuration actions
      setSimulationConfig: (config) => {
        set((state) => ({
          simulation: { ...state.simulation, ...config },
        }));
      },

      setDisplayConfig: (config) => {
        set((state) => ({
          display: { ...state.display, ...config },
        }));
      },

      setDefaultsConfig: (config) => {
        set((state) => ({
          defaults: { ...state.defaults, ...config },
        }));
      },

      // Time simulation actions
      enableTimeSimulation: () => {
        set((state) => ({
          timeSimulation: {
            ...state.timeSimulation,
            enabled: true,
            simulatedDate: state.timeSimulation.simulatedDate || new Date(),
          },
        }));
      },

      disableTimeSimulation: () => {
        set((state) => ({
          timeSimulation: {
            ...state.timeSimulation,
            enabled: false,
            simulatedDate: null,
          },
        }));
      },

      setSimulatedDate: (date: Date) => {
        set((state) => ({
          timeSimulation: {
            ...state.timeSimulation,
            simulatedDate: date,
          },
        }));
      },

      advanceTime: (days: number) => {
        set((state) => {
          const currentDate = state.timeSimulation.simulatedDate || new Date();
          const newDate = new Date(currentDate);
          newDate.setDate(newDate.getDate() + days);
          return {
            timeSimulation: {
              ...state.timeSimulation,
              enabled: true,
              simulatedDate: newDate,
            },
          };
        });
      },

      getCurrentTime: () => {
        const state = get();
        if (state.timeSimulation.enabled && state.timeSimulation.simulatedDate) {
          return new Date(state.timeSimulation.simulatedDate);
        }
        return new Date();
      },
    }),
    {
      name: 'qzpay-playground-config',
      // Only persist certain fields (not the billing instance)
      partialize: (state) => ({
        paymentMode: state.paymentMode,
        stripeSecretKey: state.stripeSecretKey,
        mercadopagoAccessToken: state.mercadopagoAccessToken,
        mercadopagoPublicKey: state.mercadopagoPublicKey,
        isInitialized: state.isInitialized,
        // Persist extended configuration
        simulation: state.simulation,
        display: state.display,
        defaults: state.defaults,
        // Persist time simulation (convert Date to ISO string for JSON serialization)
        timeSimulation: {
          ...state.timeSimulation,
          simulatedDate: state.timeSimulation.simulatedDate?.toISOString() ?? null,
        },
      }),
      // Re-initialize billing on hydration if was previously initialized
      onRehydrateStorage: () => (state) => {
        // Convert simulatedDate back to Date object after rehydration
        if (state?.timeSimulation?.simulatedDate) {
          state.timeSimulation.simulatedDate = new Date(state.timeSimulation.simulatedDate as unknown as string);
        }
        if (state?.isInitialized) {
          // Defer initialization to avoid blocking hydration
          setTimeout(() => {
            state.initializeBilling();
          }, 0);
        }
      },
    }
  )
);
