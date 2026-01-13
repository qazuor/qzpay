import { useTranslation } from 'react-i18next';
import { useWizardStore } from '../../stores/wizard.store';
import { ChevronLeft, ChevronRight, SkipForward, X } from 'lucide-react';

interface WizardControlsProps {
  onNavigate: (view: string) => void;
}

export function WizardControls({ onNavigate }: WizardControlsProps) {
  const { t } = useTranslation('wizard');
  const {
    nextStep,
    prevStep,
    skipStep,
    exitWizard,
    canGoPrev,
    getCurrentStep,
  } = useWizardStore();

  const currentStep = getCurrentStep();
  const isLastStep = currentStep?.id === 'complete';
  const isFirstStep = currentStep?.id === 'welcome';

  const handleNext = () => {
    nextStep();
    const nextStepData = getCurrentStep();
    if (nextStepData) {
      onNavigate(nextStepData.targetView);
    }
  };

  const handlePrev = () => {
    prevStep();
    const prevStepData = getCurrentStep();
    if (prevStepData) {
      onNavigate(prevStepData.targetView);
    }
  };

  const handleSkip = () => {
    skipStep();
    const nextStepData = getCurrentStep();
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
        {canGoPrev() && !isFirstStep && (
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
