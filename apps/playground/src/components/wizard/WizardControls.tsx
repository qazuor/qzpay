import { useTranslation } from 'react-i18next';
import { useWizardStore, WIZARD_STEPS } from '../../stores/wizard.store';
import { ChevronLeft, ChevronRight, SkipForward, X } from 'lucide-react';

interface WizardControlsProps {
  onNavigate: (view: string) => void;
}

export function WizardControls({ onNavigate }: WizardControlsProps) {
  const { t } = useTranslation('wizard');
  const {
    currentStepIndex,
    nextStep,
    prevStep,
    skipStep,
    exitWizard,
  } = useWizardStore();

  const currentStep = WIZARD_STEPS[currentStepIndex] || null;
  const isLastStep = currentStep?.id === 'complete';
  const isFirstStep = currentStep?.id === 'welcome';
  const canGoPrev = currentStepIndex > 0;

  const handleNext = () => {
    nextStep();
    // Navigate to next step (currentStepIndex + 1)
    const nextStepData = WIZARD_STEPS[currentStepIndex + 1];
    if (nextStepData) {
      onNavigate(nextStepData.targetView);
    }
  };

  const handlePrev = () => {
    prevStep();
    // Navigate to previous step (currentStepIndex - 1)
    const prevStepData = WIZARD_STEPS[currentStepIndex - 1];
    if (prevStepData) {
      onNavigate(prevStepData.targetView);
    }
  };

  const handleSkip = () => {
    skipStep();
    // Navigate to next step (currentStepIndex + 1)
    const nextStepData = WIZARD_STEPS[currentStepIndex + 1];
    if (nextStepData) {
      onNavigate(nextStepData.targetView);
    }
  };

  const handleExit = () => {
    exitWizard();
  };

  const handleFinish = () => {
    exitWizard();
    onNavigate('welcome');
  };

  return (
    <div className="wizard-controls flex items-center justify-between pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
      {/* Left side - Exit button */}
      <button
        type="button"
        onClick={handleExit}
        className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg transition-colors hover:opacity-80"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <X className="w-4 h-4" />
        {t('controls.exit')}
      </button>

      {/* Right side - Navigation buttons */}
      <div className="flex items-center gap-2">
        {/* Previous button */}
        {canGoPrev && !isFirstStep && (
          <button
            type="button"
            onClick={handlePrev}
            className="flex items-center gap-1 px-4 py-2 text-sm rounded-lg transition-colors"
            style={{
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
            }}
          >
            <ChevronLeft className="w-4 h-4" />
            {t('controls.previous')}
          </button>
        )}

        {/* Skip button (not on first or last step) */}
        {!isFirstStep && !isLastStep && (
          <button
            type="button"
            onClick={handleSkip}
            className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg transition-colors hover:opacity-80"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {t('controls.skip')}
            <SkipForward className="w-4 h-4" />
          </button>
        )}

        {/* Next / Finish button */}
        {isLastStep ? (
          <button
            type="button"
            onClick={handleFinish}
            className="flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{
              backgroundColor: 'var(--color-success)',
              color: 'white',
            }}
          >
            {t('controls.finish')}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'white',
            }}
          >
            {isFirstStep ? t('controls.start') : t('controls.next')}
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
