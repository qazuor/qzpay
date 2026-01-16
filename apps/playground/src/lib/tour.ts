/**
 * Tour Configuration
 * Uses Driver.js for guided spotlight tour
 */
import { type Config, type DriveStep, driver } from 'driver.js';
import type { TFunction } from 'i18next';

// CSS import handled in index.css

export const tourConfig: Config = {
    showProgress: true,
    animate: true,
    allowClose: true,
    overlayColor: 'rgba(0, 0, 0, 0.75)',
    stagePadding: 10,
    stageRadius: 8,
    popoverClass: 'qzpay-tour-popover',
    progressText: '{{current}} / {{total}}'
};

/**
 * Create tour steps with translations
 */
export function createTourSteps(
    t: TFunction,
    callbacks: {
        onNavigate: (view: string) => void;
    }
): DriveStep[] {
    const { onNavigate } = callbacks;

    return [
        // ========== FASE 1: BIENVENIDA Y SETUP ==========
        {
            popover: {
                title: t('tour.welcome.title'),
                description: t('tour.welcome.description'),
                side: 'over',
                align: 'center'
            }
        },
        {
            element: '[data-tour="sidebar"]',
            popover: {
                title: t('tour.sidebar.title'),
                description: t('tour.sidebar.description'),
                side: 'right',
                align: 'start'
            }
        },
        {
            element: '[data-tour="sidebar-setup"]',
            popover: {
                title: t('tour.sidebarSetup.title'),
                description: t('tour.sidebarSetup.description'),
                side: 'right',
                align: 'start'
            },
            onHighlightStarted: () => onNavigate('setup')
        },
        // Provider selector FIRST (required to initialize)
        {
            element: '[data-tour="provider-selector"]',
            popover: {
                title: t('tour.providers.title'),
                description: t('tour.providers.description'),
                side: 'bottom',
                align: 'start'
            }
        },
        // Templates appear AFTER initialization
        {
            element: '[data-tour="template-selector"]',
            popover: {
                title: t('tour.templates.title'),
                description: t('tour.templates.description'),
                side: 'bottom',
                align: 'start'
            }
        },

        // ========== FASE 2: CATALOGO ==========
        {
            element: '[data-tour="sidebar-catalog"]',
            popover: {
                title: t('tour.catalog.title'),
                description: t('tour.catalog.description'),
                side: 'right',
                align: 'start'
            }
        },
        {
            element: '[data-tour="sidebar-plans"]',
            popover: {
                title: t('tour.plans.title'),
                description: t('tour.plans.description'),
                side: 'right',
                align: 'center'
            },
            onHighlightStarted: () => onNavigate('plans')
        },
        {
            element: '[data-tour="sidebar-prices"]',
            popover: {
                title: t('tour.prices.title'),
                description: t('tour.prices.description'),
                side: 'right',
                align: 'center'
            },
            onHighlightStarted: () => onNavigate('prices')
        },
        {
            element: '[data-tour="sidebar-entitlements"]',
            popover: {
                title: t('tour.entitlements.title'),
                description: t('tour.entitlements.description'),
                side: 'right',
                align: 'center'
            },
            onHighlightStarted: () => onNavigate('entitlements')
        },

        // ========== FASE 3: SIMULACION ==========
        {
            element: '[data-tour="sidebar-simulate"]',
            popover: {
                title: t('tour.simulate.title'),
                description: t('tour.simulate.description'),
                side: 'right',
                align: 'start'
            }
        },
        {
            element: '[data-tour="sidebar-customers"]',
            popover: {
                title: t('tour.customers.title'),
                description: t('tour.customers.description'),
                side: 'right',
                align: 'center'
            },
            onHighlightStarted: () => onNavigate('customers')
        },
        {
            element: '[data-tour="sidebar-subscriptions"]',
            popover: {
                title: t('tour.subscriptions.title'),
                description: t('tour.subscriptions.description'),
                side: 'right',
                align: 'center'
            },
            onHighlightStarted: () => onNavigate('subscriptions')
        },
        {
            element: '[data-tour="sidebar-payments"]',
            popover: {
                title: t('tour.payments.title'),
                description: t('tour.payments.description'),
                side: 'right',
                align: 'center'
            },
            onHighlightStarted: () => onNavigate('payments')
        },

        // ========== FASE 4: HERRAMIENTAS ==========
        {
            element: '[data-tour="header"]',
            popover: {
                title: t('tour.header.title'),
                description: t('tour.header.description'),
                side: 'bottom',
                align: 'center'
            }
        },
        {
            element: '[data-tour="panel-toggles"]',
            popover: {
                title: t('tour.panels.title'),
                description: t('tour.panels.description'),
                side: 'bottom',
                align: 'end'
            }
        },
        {
            element: '[data-tour="header-actions"]',
            popover: {
                title: t('tour.actions.title'),
                description: t('tour.actions.description'),
                side: 'bottom',
                align: 'end'
            }
        },

        // ========== FASE 5: COMPONENTES ==========
        {
            element: '[data-tour="sidebar-components"]',
            popover: {
                title: t('tour.components.title'),
                description: t('tour.components.description'),
                side: 'right',
                align: 'center'
            },
            onHighlightStarted: () => onNavigate('components')
        },

        // ========== FINALIZACION ==========
        {
            popover: {
                title: t('tour.complete.title'),
                description: t('tour.complete.description'),
                side: 'over',
                align: 'center'
            },
            onHighlightStarted: () => onNavigate('setup')
        }
    ];
}

/**
 * Start the guided tour
 */
export function startGuidedTour(
    t: TFunction,
    callbacks: {
        onNavigate: (view: string) => void;
        onComplete?: () => void;
        onClose?: () => void;
    }
) {
    const steps = createTourSteps(t, callbacks);

    const driverObj = driver({
        ...tourConfig,
        steps,
        nextBtnText: t('tour.buttons.next'),
        prevBtnText: t('tour.buttons.prev'),
        doneBtnText: t('tour.buttons.done'),
        onDestroyStarted: () => {
            if (callbacks.onClose) {
                callbacks.onClose();
            }
            driverObj.destroy();
        },
        onDestroyed: () => {
            if (callbacks.onComplete) {
                callbacks.onComplete();
            }
        }
    });

    driverObj.drive();
    return driverObj;
}
