/**
 * Wizard Store
 * Manages the guided tour/wizard state
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ViewType } from '../App';

export interface WizardStep {
  id: string;
  titleKey: string;
  descriptionKey: string;
  targetView: ViewType;
  validationKey?: string; // Key to check in validation functions
  highlightSelector?: string; // CSS selector for element to highlight
}

export const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'welcome',
    titleKey: 'steps.welcome.title',
    descriptionKey: 'steps.welcome.description',
    targetView: 'welcome',
  },
  {
    id: 'setup',
    titleKey: 'steps.setup.title',
    descriptionKey: 'steps.setup.description',
    targetView: 'setup',
    validationKey: 'hasPaymentMode',
  },
  {
    id: 'plans',
    titleKey: 'steps.plans.title',
    descriptionKey: 'steps.plans.description',
    targetView: 'plans',
    validationKey: 'hasPlans',
  },
  {
    id: 'prices',
    titleKey: 'steps.prices.title',
    descriptionKey: 'steps.prices.description',
    targetView: 'prices',
    validationKey: 'hasPrices',
  },
  {
    id: 'customers',
    titleKey: 'steps.customers.title',
    descriptionKey: 'steps.customers.description',
    targetView: 'customers',
    validationKey: 'hasCustomers',
  },
  {
    id: 'subscriptions',
    titleKey: 'steps.subscriptions.title',
    descriptionKey: 'steps.subscriptions.description',
    targetView: 'subscriptions',
    validationKey: 'hasSubscriptions',
  },
  {
    id: 'actions',
    titleKey: 'steps.actions.title',
    descriptionKey: 'steps.actions.description',
    targetView: 'subscriptions',
  },
  {
    id: 'events',
    titleKey: 'steps.events.title',
    descriptionKey: 'steps.events.description',
    targetView: 'events',
  },
  {
    id: 'components',
    titleKey: 'steps.components.title',
    descriptionKey: 'steps.components.description',
    targetView: 'components',
  },
  {
    id: 'complete',
    titleKey: 'steps.complete.title',
    descriptionKey: 'steps.complete.description',
    targetView: 'welcome',
  },
];

interface WizardState {
  isActive: boolean;
  currentStepIndex: number;
  completedSteps: string[];
  skippedSteps: string[];

  // Actions
  startWizard: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipStep: () => void;
  goToStep: (index: number) => void;
  completeCurrentStep: () => void;
  exitWizard: () => void;
  resetWizard: () => void;

  // Getters
  getCurrentStep: () => WizardStep | null;
  getProgress: () => { current: number; total: number; percentage: number };
  isStepCompleted: (stepId: string) => boolean;
  canGoNext: () => boolean;
  canGoPrev: () => boolean;
}

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      isActive: false,
      currentStepIndex: 0,
      completedSteps: [],
      skippedSteps: [],

      startWizard: () => {
        set({
          isActive: true,
          currentStepIndex: 0,
        });
      },

      nextStep: () => {
        const { currentStepIndex, completedSteps } = get();
        const currentStep = WIZARD_STEPS[currentStepIndex];

        if (currentStepIndex < WIZARD_STEPS.length - 1) {
          // Mark current step as completed if not already
          const newCompletedSteps = currentStep && !completedSteps.includes(currentStep.id)
            ? [...completedSteps, currentStep.id]
            : completedSteps;

          set({
            currentStepIndex: currentStepIndex + 1,
            completedSteps: newCompletedSteps,
          });
        } else {
          // Last step - complete the wizard
          get().exitWizard();
        }
      },

      prevStep: () => {
        const { currentStepIndex } = get();
        if (currentStepIndex > 0) {
          set({ currentStepIndex: currentStepIndex - 1 });
        }
      },

      skipStep: () => {
        const { currentStepIndex, skippedSteps } = get();
        const currentStep = WIZARD_STEPS[currentStepIndex];

        if (currentStepIndex < WIZARD_STEPS.length - 1) {
          const newSkippedSteps = currentStep && !skippedSteps.includes(currentStep.id)
            ? [...skippedSteps, currentStep.id]
            : skippedSteps;

          set({
            currentStepIndex: currentStepIndex + 1,
            skippedSteps: newSkippedSteps,
          });
        }
      },

      goToStep: (index: number) => {
        if (index >= 0 && index < WIZARD_STEPS.length) {
          set({ currentStepIndex: index });
        }
      },

      completeCurrentStep: () => {
        const { currentStepIndex, completedSteps } = get();
        const currentStep = WIZARD_STEPS[currentStepIndex];

        if (currentStep && !completedSteps.includes(currentStep.id)) {
          set({ completedSteps: [...completedSteps, currentStep.id] });
        }
      },

      exitWizard: () => {
        set({ isActive: false });
      },

      resetWizard: () => {
        set({
          isActive: false,
          currentStepIndex: 0,
          completedSteps: [],
          skippedSteps: [],
        });
      },

      getCurrentStep: () => {
        const { currentStepIndex } = get();
        return WIZARD_STEPS[currentStepIndex] || null;
      },

      getProgress: () => {
        const { currentStepIndex } = get();
        const total = WIZARD_STEPS.length;
        return {
          current: currentStepIndex + 1,
          total,
          percentage: Math.round(((currentStepIndex + 1) / total) * 100),
        };
      },

      isStepCompleted: (stepId: string) => {
        return get().completedSteps.includes(stepId);
      },

      canGoNext: () => {
        const { currentStepIndex } = get();
        return currentStepIndex < WIZARD_STEPS.length - 1;
      },

      canGoPrev: () => {
        const { currentStepIndex } = get();
        return currentStepIndex > 0;
      },
    }),
    {
      name: 'qzpay_playground_wizard',
      partialize: (state) => ({
        isActive: state.isActive,
        currentStepIndex: state.currentStepIndex,
        completedSteps: state.completedSteps,
        skippedSteps: state.skippedSteps,
      }),
    }
  )
);
