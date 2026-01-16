import type { QZPaySubscription } from '@qazuor/qzpay-core';
import { useCallback, useState } from 'react';

/**
 * Modal types enum for type safety
 */
export enum ModalType {
    CREATE_SUBSCRIPTION = 'createSubscription',
    PAYMENT = 'payment',
    CHANGE_PLAN = 'changePlan',
    ADD_ON = 'addOn',
    ONE_TIME_PAYMENT = 'oneTimePayment',
    RENEWAL = 'renewal'
}

/**
 * Pending subscription data for payment modal
 */
export interface PendingSubscription {
    customerId: string;
    planId: string;
    priceId: string;
    amount: number;
    currency: string;
    description: string;
    hasTrial: boolean;
    trialDays: number | null;
}

/**
 * Renewal data for renewal payment modal
 */
export interface RenewalData {
    subscription: QZPaySubscription;
    amount: number;
    currency: string;
}

/**
 * Modal state interface
 */
interface ModalState {
    // Currently open modal (null if none)
    openModal: ModalType | null;

    // Modal-specific data
    pendingSubscription: PendingSubscription | null;
    subscriptionToChange: QZPaySubscription | null;
    subscriptionForAddOn: QZPaySubscription | null;
    subscriptionToRenew: RenewalData | null;
}

/**
 * Actions for modal management
 */
interface ModalActions {
    // Generic open/close
    openModalByType: (type: ModalType) => void;
    closeModal: () => void;
    isModalOpen: (type: ModalType) => boolean;

    // Specific modal openers with data
    openPaymentModal: (data: PendingSubscription) => void;
    openChangePlanModal: (subscription: QZPaySubscription) => void;
    openAddOnModal: (subscription: QZPaySubscription) => void;
    openRenewalModal: (data: RenewalData) => void;

    // Getters for modal data
    getPendingSubscription: () => PendingSubscription | null;
    getSubscriptionToChange: () => QZPaySubscription | null;
    getSubscriptionForAddOn: () => QZPaySubscription | null;
    getSubscriptionToRenew: () => RenewalData | null;
}

/**
 * Custom hook to manage modal states in a centralized way
 *
 * Consolidates multiple modal states into a single state object
 * with type-safe actions and getters.
 *
 * @example
 * ```tsx
 * const modal = useModalState();
 *
 * // Open a modal
 * modal.openModalByType(ModalType.CREATE_SUBSCRIPTION);
 *
 * // Open with data
 * modal.openPaymentModal({ customerId: '...', ... });
 *
 * // Check if open
 * if (modal.isModalOpen(ModalType.PAYMENT)) { ... }
 *
 * // Close
 * modal.closeModal();
 * ```
 */
export function useModalState(): ModalState & ModalActions {
    const [state, setState] = useState<ModalState>({
        openModal: null,
        pendingSubscription: null,
        subscriptionToChange: null,
        subscriptionForAddOn: null,
        subscriptionToRenew: null
    });

    const openModalByType = useCallback((type: ModalType) => {
        setState((prev) => ({ ...prev, openModal: type }));
    }, []);

    const closeModal = useCallback(() => {
        setState({
            openModal: null,
            pendingSubscription: null,
            subscriptionToChange: null,
            subscriptionForAddOn: null,
            subscriptionToRenew: null
        });
    }, []);

    const isModalOpen = useCallback(
        (type: ModalType) => {
            return state.openModal === type;
        },
        [state.openModal]
    );

    const openPaymentModal = useCallback((data: PendingSubscription) => {
        setState({
            openModal: ModalType.PAYMENT,
            pendingSubscription: data,
            subscriptionToChange: null,
            subscriptionForAddOn: null,
            subscriptionToRenew: null
        });
    }, []);

    const openChangePlanModal = useCallback((subscription: QZPaySubscription) => {
        setState({
            openModal: ModalType.CHANGE_PLAN,
            subscriptionToChange: subscription,
            pendingSubscription: null,
            subscriptionForAddOn: null,
            subscriptionToRenew: null
        });
    }, []);

    const openAddOnModal = useCallback((subscription: QZPaySubscription) => {
        setState({
            openModal: ModalType.ADD_ON,
            subscriptionForAddOn: subscription,
            pendingSubscription: null,
            subscriptionToChange: null,
            subscriptionToRenew: null
        });
    }, []);

    const openRenewalModal = useCallback((data: RenewalData) => {
        setState({
            openModal: ModalType.RENEWAL,
            subscriptionToRenew: data,
            pendingSubscription: null,
            subscriptionToChange: null,
            subscriptionForAddOn: null
        });
    }, []);

    const getPendingSubscription = useCallback(() => state.pendingSubscription, [state.pendingSubscription]);
    const getSubscriptionToChange = useCallback(() => state.subscriptionToChange, [state.subscriptionToChange]);
    const getSubscriptionForAddOn = useCallback(() => state.subscriptionForAddOn, [state.subscriptionForAddOn]);
    const getSubscriptionToRenew = useCallback(() => state.subscriptionToRenew, [state.subscriptionToRenew]);

    return {
        ...state,
        openModalByType,
        closeModal,
        isModalOpen,
        openPaymentModal,
        openChangePlanModal,
        openAddOnModal,
        openRenewalModal,
        getPendingSubscription,
        getSubscriptionToChange,
        getSubscriptionForAddOn,
        getSubscriptionToRenew
    };
}
